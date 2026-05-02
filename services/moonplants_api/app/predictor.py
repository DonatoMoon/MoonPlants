import pickle
import pathlib
import logging
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
import numpy as np
import pandas as pd

from app.config import DEFAULT_CONFIG
from app.features import build_features
from app.data_client import SupabaseDataClient

MODELS_DIR = Path(__file__).parent.parent / "models"
logger = logging.getLogger(__name__)

# Make models/ importable so the research wrapper classes resolve during unpickling
_api_root = str(MODELS_DIR.parent)
if _api_root not in sys.path:
    sys.path.insert(0, _api_root)

# Module paths used when research notebooks pickled these objects
_MODULE_REMAP = {
    "src.models.lgbm_model":     "models.lgbm_model",
    "src.models.xgboost_model":  "models.xgboost_model",
}

class _Stub:
    """Absorbs any object whose state we don't need at inference time."""
    def __init__(self, *a, **kw): pass
    def __setstate__(self, state): pass


def _stub_ctor(*a, **kw):
    """Drop-in for numpy RNG ctors (__bit_generator_ctor, __generator_ctor,
    __randomstate_ctor). Returns a _Stub that absorbs __setstate__ silently."""
    return _Stub()


# numpy.random._pickle exports these names depending on the version
_NP_RNG_CTORS = {
    "__bit_generator_ctor",
    "__generator_ctor",
    "__randomstate_ctor",
}


class _ResearchUnpickler(pickle.Unpickler):
    """Remaps research-env module paths → API-service paths.
    Stubs optuna objects and numpy RNG state (tuning artifacts, not
    needed for inference) to survive cross-version pickle incompatibility."""

    def find_class(self, module, name):
        if module == "pathlib" and name == "WindowsPath":
            return pathlib.PurePosixPath
        if module.startswith("optuna"):
            return _Stub
        # Intercept all numpy random restore functions — their pickled state
        # may be in a format incompatible with the deployed numpy version.
        if module == "numpy.random._pickle" and name in _NP_RNG_CTORS:
            return _stub_ctor
        module = _MODULE_REMAP.get(module, module)
        return super().find_class(module, name)


def _load_pkl(path: Path):
    with open(path, "rb") as f:
        return _ResearchUnpickler(f).load()


class Predictor:
    def __init__(self):
        self.lgbm_tte = None   # LGBMModel — TTE
        self.xgb_tte = None    # XGBModel  — TTE
        self.xgb_amount = None  # XGBModel  — Amount
        self.data_client: Optional[SupabaseDataClient] = None
        self._loaded = False

    def load(self, supabase_url: str, supabase_key: str):
        self.lgbm_tte   = _load_pkl(MODELS_DIR / "lgbm_tte.pkl")
        self.xgb_tte    = _load_pkl(MODELS_DIR / "xgb_tte.pkl")
        self.xgb_amount = _load_pkl(MODELS_DIR / "xgb_amount.pkl")
        self.data_client = SupabaseDataClient(supabase_url, supabase_key)
        self._loaded = True
        logger.info(
            "Models loaded. lgbm_tte=%s, xgb_tte=%s, xgb_amount=%s",
            type(self.lgbm_tte).__name__,
            type(self.xgb_tte).__name__,
            type(self.xgb_amount).__name__,
        )

    def predict(self, plant_uuid: str, reference_time: Optional[datetime] = None) -> dict:
        if not self._loaded:
            raise RuntimeError("Models not loaded. Call .load() first.")
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        cfg = DEFAULT_CONFIG
        data = self.data_client.fetch_all(plant_uuid, reference_time)

        feat = build_features(
            readings=data["readings"],
            watering_events=data["watering_events"],
            plant_instances=data["plant_instances"],
            species=data["species"],
            cfg=cfg,
            add_targets=False,
        )

        if feat.empty:
            raise ValueError(f"No features built for plant {plant_uuid}")

        snapshot = feat.sort_values("timestamp_utc").iloc[-1]
        current_moisture = float(snapshot["soil_moisture"])

        watering = data["species"]["watering_category"].iloc[0] if len(data["species"]) else "Average"
        if watering == "Minimum":
            low_thr, high_tgt = 0.20, 0.55
        elif watering == "Frequent":
            low_thr, high_tgt = 0.35, 0.70
        else:
            low_thr = cfg.trajectory_model.default_low_threshold
            high_tgt = cfg.trajectory_model.default_high_target

        X_snap = pd.DataFrame([snapshot])

        # TTE ensemble: weighted average 45% LightGBM + 55% XGBoost
        lgbm_hours = float(self.lgbm_tte.predict(X_snap)[0])
        xgb_hours  = float(self.xgb_tte.predict(X_snap)[0])
        ensemble_hours = max(0.0, 0.45 * lgbm_hours + 0.55 * xgb_hours)
        confidence = "high" if abs(lgbm_hours - xgb_hours) < 12 else "medium"

        # Amount: direct XGBoost prediction
        target_moisture = (low_thr + high_tgt) / 2.0
        snap_amt = snapshot.copy()
        snap_amt["delta_moisture_target"] = target_moisture - current_moisture
        X_amt = pd.DataFrame([snap_amt])
        recommended_ml = float(self.xgb_amount.predict(X_amt)[0])
        recommended_ml = max(recommended_ml, cfg.amount_model.min_amount_ml)

        rationale = (
            f"Current moisture: {current_moisture:.3f} | "
            f"LightGBM TTE: {lgbm_hours:.1f}h | "
            f"XGBoost TTE: {xgb_hours:.1f}h | "
            f"Ensemble (45/55): {ensemble_hours:.1f}h ({confidence}) | "
            f"Recommended: {recommended_ml:.0f}ml"
        )

        return {
            "plant_id": plant_uuid,
            "timestamp": reference_time.isoformat(),
            "current_moisture": round(current_moisture, 4),
            "time_to_water_hours": round(ensemble_hours, 2),
            "recommended_ml": round(recommended_ml, 1),
            "confidence": confidence,
            "trajectory_hours": None,
            "tte_pred_hours": round(ensemble_hours, 2),
            "low_threshold": low_thr,
            "high_target": high_tgt,
            "rationale": rationale,
        }
