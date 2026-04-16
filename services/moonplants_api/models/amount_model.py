"""
Watering Amount Model
- Predicts amount_ml needed to bring moisture from current level to target.
- Trained on watering_events: features = plant state at event time, target = amount_ml.
- Inference: given current moisture + target moisture, return recommended ml.
- No hard cap: physical upper bound derived from pot_volume_ml * (target - current) / soil_retention.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd

try:
    import lightgbm as lgb
    _LGBM_AVAILABLE = True
except ImportError:
    _LGBM_AVAILABLE = False

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)

_DROP_COLS = {
    "timestamp_utc", "device_id",
    "soil_moisture_raw",
    "is_watering_event", "watering_amount_ml",
    "hours_to_next_watering",
    "moisture_at_horizon",
    "api_json",
    "common_name", "scientific_name", "family", "origin",
    "type", "cycle", "watering", "soil", "sunlight",
    "nickname", "soil_mix", "orientation",
    # targets from watering events
    "amount_ml", "moisture_after", "target_moisture",
    "runoff_fraction", "reason", "event_id",
}


def _get_feature_cols(df: pd.DataFrame) -> List[str]:
    drop = _DROP_COLS | {"plant_instance_id", "species_id"}
    return [
        c for c in df.columns
        if c not in drop and pd.api.types.is_numeric_dtype(df[c])
    ]


def build_amount_dataset(
    watering_events: pd.DataFrame,
    features_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Join watering events with the feature snapshot at event time.
    For each watering event, find the closest preceding reading row
    (per plant) and attach its features.

    Returns a DataFrame with feature columns + 'amount_ml' target.
    """
    records = []
    feat_by_plant = {
        pid: grp.sort_values("timestamp_utc")
        for pid, grp in features_df.groupby("plant_instance_id")
    }

    for _, ev in watering_events.iterrows():
        pid = ev["plant_instance_id"]
        ev_ts = ev["timestamp_utc"]
        if pid not in feat_by_plant:
            continue
        plant_feat = feat_by_plant[pid]
        # Find last reading strictly before or at event time
        mask = plant_feat["timestamp_utc"] <= ev_ts
        if not mask.any():
            continue
        snapshot = plant_feat.loc[mask].iloc[-1].copy()
        # Override moisture_before from event record (ground truth at event)
        snapshot["soil_moisture"] = ev["moisture_before"]
        snapshot["amount_ml"] = ev["amount_ml"]
        snapshot["target_moisture"] = ev.get("target_moisture", np.nan)
        snapshot["moisture_after"] = ev.get("moisture_after", np.nan)
        # Add delta_moisture as a feature (how much we want to raise)
        if not pd.isna(ev.get("target_moisture")):
            snapshot["delta_moisture_target"] = ev["target_moisture"] - ev["moisture_before"]
        else:
            snapshot["delta_moisture_target"] = np.nan
        records.append(snapshot)

    if not records:
        raise ValueError("No amount training samples could be built from watering events.")

    df = pd.DataFrame(records).reset_index(drop=True)
    logger.info("Amount dataset built: %d samples", len(df))
    return df


class AmountModel:
    """
    Predicts watering amount_ml.
    Also provides physics-based fallback: amount = pot_volume_ml * delta_moisture / soil_retention.
    """

    def __init__(self, cfg: Config = DEFAULT_CONFIG) -> None:
        self.cfg = cfg
        self.feature_cols: List[str] = []
        self._model = None
        self._per_plant_bias: dict[int, float] = {}

    def fit(
        self,
        amount_df: pd.DataFrame,
        val_amount_df: Optional[pd.DataFrame] = None,
    ) -> "AmountModel":
        """
        Train on amount_df (output of build_amount_dataset).
        val_amount_df is optional; if None, a 20% random split is used.
        """
        mc = self.cfg.amount_model
        target = "amount_ml"

        df = amount_df.dropna(subset=[target]).copy()
        df = df[df[target] >= mc.min_amount_ml]

        self.feature_cols = _get_feature_cols(df)
        # Always include delta_moisture_target if present
        if "delta_moisture_target" in df.columns and "delta_moisture_target" not in self.feature_cols:
            self.feature_cols.append("delta_moisture_target")

        logger.info("AmountModel: %d features, %d samples", len(self.feature_cols), len(df))

        if val_amount_df is not None:
            val_c = val_amount_df.dropna(subset=[target]).copy()
        else:
            from sklearn.model_selection import train_test_split
            df, val_c = train_test_split(df, test_size=0.2, random_state=mc.random_state)

        X_train = df[self.feature_cols].fillna(0).astype(np.float32)
        y_train = df[target].astype(np.float32)
        X_val   = val_c[self.feature_cols].fillna(0).astype(np.float32)
        y_val   = val_c[target].astype(np.float32)

        if _LGBM_AVAILABLE:
            dtrain = lgb.Dataset(X_train, label=y_train)
            dval   = lgb.Dataset(X_val, label=y_val, reference=dtrain)
            params = {
                "objective": "regression_l1",
                "metric": "mae",
                "num_leaves": mc.num_leaves,
                "learning_rate": mc.learning_rate,
                "min_child_samples": mc.min_child_samples,
                "subsample": mc.subsample,
                "colsample_bytree": mc.colsample_bytree,
                "random_state": mc.random_state,
                "verbose": -1,
            }
            callbacks = [
                lgb.early_stopping(mc.early_stopping_rounds, verbose=False),
                lgb.log_evaluation(period=50),
            ]
            self._model = lgb.train(
                params, dtrain,
                num_boost_round=mc.n_estimators,
                valid_sets=[dval],
                callbacks=callbacks,
            )
            logger.info("LightGBM AmountModel trained, best_iteration=%d",
                        self._model.best_iteration)
        else:
            from sklearn.ensemble import GradientBoostingRegressor
            self._model = GradientBoostingRegressor(
                n_estimators=mc.n_estimators,
                learning_rate=mc.learning_rate,
                max_leaf_nodes=mc.num_leaves,
                min_samples_leaf=mc.min_child_samples,
                subsample=mc.subsample,
                random_state=mc.random_state,
            )
            self._model.fit(X_train, y_train)

        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        Xf = X[self.feature_cols].fillna(0).astype(np.float32)
        if _LGBM_AVAILABLE:
            raw = self._model.predict(Xf, num_iteration=self._model.best_iteration)
        else:
            raw = self._model.predict(Xf)
        return np.clip(raw, self.cfg.amount_model.min_amount_ml, None)

    def recommend_amount(
        self,
        snapshot: pd.Series,
        target_moisture: float,
        plant_instance_id: int,
    ) -> float:
        """
        Given the current sensor snapshot and desired target_moisture,
        predict the amount_ml to dispense.

        Falls back to physics formula if model can't predict:
          amount_ml ≈ pot_volume_ml * (target - current) / soil_retention_factor
          adjusted for drainage: effective_amount = amount_ml / (1 - runoff_fraction)
        """
        snap = snapshot.copy()
        current_moisture = float(snap.get("soil_moisture", 0.4))
        snap["delta_moisture_target"] = target_moisture - current_moisture

        try:
            X = pd.DataFrame([snap])
            pred = float(self.predict(X)[0])
            bias = self._per_plant_bias.get(int(plant_instance_id), 0.0)
            pred = max(pred + bias, self.cfg.amount_model.min_amount_ml)
            return pred
        except Exception as exc:
            logger.warning("AmountModel predict failed (%s), using physics fallback", exc)
            return self._physics_fallback(snap, target_moisture, current_moisture)

    def _physics_fallback(
        self,
        snap: pd.Series,
        target_moisture: float,
        current_moisture: float,
    ) -> float:
        pot_vol = float(snap.get("pot_volume_ml", 1000.0))
        retention = float(snap.get("soil_retention_factor", 1.0))
        drainage = float(snap.get("drainage_factor", 0.7))
        delta = max(target_moisture - current_moisture, 0.0)
        # Water absorbed by soil = pot_vol * delta * retention
        # Total water needed accounts for runoff:  total / (1 - (1 - drainage)) = total / drainage
        absorbed = pot_vol * delta * retention
        total = absorbed / max(drainage, 0.1)
        return max(total, self.cfg.amount_model.min_amount_ml)

    def calibrate_plant_bias(
        self,
        amount_df: pd.DataFrame,
        plant_instance_id: int,
        min_events: int = 2,
    ) -> float:
        valid = amount_df.dropna(subset=["amount_ml"])
        if len(valid) < min_events:
            return 0.0
        preds = self.predict(valid)
        residuals = valid["amount_ml"].values - preds
        bias = float(np.mean(residuals))
        self._per_plant_bias[int(plant_instance_id)] = bias
        logger.info("Plant %d amount bias: %.1f ml", plant_instance_id, bias)
        return bias

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        logger.info("AmountModel saved to %s", path)

    @classmethod
    def load(cls, path: Path) -> "AmountModel":
        with open(path, "rb") as f:
            obj = pickle.load(f)
        logger.info("AmountModel loaded from %s", path)
        return obj

