import pickle
import pathlib
import logging
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


class _CrossPlatformUnpickler(pickle.Unpickler):
    """Replaces WindowsPath with PurePosixPath so pkl files saved on Windows
    can be loaded on Linux (Railway)."""
    def find_class(self, module, name):
        if module == "pathlib" and name == "WindowsPath":
            return pathlib.PurePosixPath
        return super().find_class(module, name)


def _load_pkl(path: Path):
    with open(path, "rb") as f:
        return _CrossPlatformUnpickler(f).load()


class Predictor:
    def __init__(self):
        self.traj_model = None
        self.tte_model  = None
        self.amt_model  = None
        self.data_client: Optional[SupabaseDataClient] = None
        self._loaded = False

    def load(self, supabase_url: str, supabase_key: str):
        self.traj_model = _load_pkl(MODELS_DIR / "trajectory_model.pkl")
        self.tte_model  = _load_pkl(MODELS_DIR / "tte_model.pkl")
        self.amt_model  = _load_pkl(MODELS_DIR / "amount_model.pkl")
        self.data_client = SupabaseDataClient(supabase_url, supabase_key)
        self._loaded = True
        logger.info("Models loaded. traj=%s, tte=%s, amt=%s",
                    type(self.traj_model).__name__,
                    type(self.tte_model).__name__,
                    type(self.amt_model).__name__)

    def predict(self, plant_uuid: str, reference_time: Optional[datetime] = None) -> dict:
        if not self._loaded:
            raise RuntimeError("Models not loaded. Call .load() first.")
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        cfg = DEFAULT_CONFIG
        data = self.data_client.fetch_all(plant_uuid, reference_time)
        plant_int_id = data["plant_int_id"]

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

        watering = data["species"]["watering"].iloc[0] if len(data["species"]) else "Average"
        if watering == "Minimum":
            low_thr, high_tgt = 0.20, 0.55
        elif watering == "Frequent":
            low_thr, high_tgt = 0.35, 0.70
        else:
            low_thr, high_tgt = cfg.trajectory_model.default_low_threshold, cfg.trajectory_model.default_high_target

        traj_hours, pred_moisture_h = self.traj_model.find_time_to_threshold(snapshot, low_threshold=low_thr)

        X_snap = pd.DataFrame([snapshot])
        tte_hours = float(self.tte_model.predict_with_bias(X_snap, plant_int_id)[0])

        if traj_hours is not None:
            ensemble_hours = 0.7 * traj_hours + 0.3 * tte_hours
            confidence = "high" if abs(traj_hours - tte_hours) < 12 else "medium"
        else:
            ensemble_hours = tte_hours
            confidence = "low"
        ensemble_hours = max(0.0, ensemble_hours)

        target_moisture = (low_thr + high_tgt) / 2.0
        recommended_ml = self.amt_model.recommend_amount(snapshot, target_moisture, plant_int_id)

        rationale = (
            f"Current moisture: {current_moisture:.3f} | "
            f"Trajectory: {f'{traj_hours:.1f}h' if traj_hours else 'no threshold crossing'} | "
            f"TTE: {tte_hours:.1f}h | "
            f"Ensemble: {ensemble_hours:.1f}h ({confidence}) | "
            f"Recommended: {recommended_ml:.0f}ml"
        )

        return {
            "plant_id": plant_uuid,
            "timestamp": reference_time.isoformat(),
            "current_moisture": round(current_moisture, 4),
            "time_to_water_hours": round(ensemble_hours, 2),
            "recommended_ml": round(recommended_ml, 1),
            "confidence": confidence,
            "trajectory_hours": round(float(traj_hours), 2) if traj_hours is not None else None,
            "tte_pred_hours": round(float(tte_hours), 2),
            "low_threshold": low_thr,
            "high_target": high_tgt,
            "rationale": rationale,
        }
