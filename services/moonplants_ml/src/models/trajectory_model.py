"""
Approach A: Moisture Trajectory Model
- Trains one LightGBM regressor to predict soil_moisture H steps ahead.
- Inference: roll over a simulated trajectory → find crossing of low threshold.
- Per-plant bias calibration is applied as additive correction.
"""
from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    import lightgbm as lgb
    _LGBM_AVAILABLE = True
except ImportError:
    from sklearn.ensemble import GradientBoostingRegressor
    _LGBM_AVAILABLE = False

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)

# Columns to drop before feeding to model
_DROP_COLS = {
    "timestamp_utc", "device_id",
    "soil_moisture_raw",
    "is_watering_event", "watering_amount_ml",   # kept for back-compat; absent in new schema
    "hours_to_next_watering",
    "moisture_at_horizon",
    "api_json",
    "common_name", "scientific_name", "family", "origin",
    "type", "cycle", "watering", "soil", "sunlight",
    "nickname", "soil_mix", "orientation",
}


def _get_feature_cols(df: pd.DataFrame) -> List[str]:
    drop = _DROP_COLS | {"plant_instance_id", "species_id"}
    return [
        c for c in df.columns
        if c not in drop and pd.api.types.is_numeric_dtype(df[c])
    ]


class TrajectoryModel:
    """
    Predict soil_moisture at t + horizon_steps.
    After training, use `find_time_to_threshold` to get hours-to-water.
    """

    def __init__(self, cfg: Config = DEFAULT_CONFIG) -> None:
        self.cfg = cfg
        self.feature_cols: List[str] = []
        self._model = None
        self._per_plant_bias: dict[int, float] = {}

    # ── Fit ──────────────────────────────────────────────────────────────────

    def fit(
        self,
        train: pd.DataFrame,
        val: pd.DataFrame,
    ) -> "TrajectoryModel":
        target = self.cfg.trajectory_model.target_col  # "soil_moisture" at horizon
        target_horizon = "moisture_at_horizon"

        # Drop rows where target is NaN (end of time series)
        train_c = train.dropna(subset=[target_horizon]).copy()
        val_c   = val.dropna(subset=[target_horizon]).copy()

        self.feature_cols = _get_feature_cols(train_c)
        logger.info("TrajectoryModel: %d features", len(self.feature_cols))

        X_train = train_c[self.feature_cols].astype(np.float32)
        y_train = train_c[target_horizon].astype(np.float32)
        X_val   = val_c[self.feature_cols].astype(np.float32)
        y_val   = val_c[target_horizon].astype(np.float32)

        mc = self.cfg.trajectory_model
        if _LGBM_AVAILABLE:
            dtrain = lgb.Dataset(X_train, label=y_train)
            dval   = lgb.Dataset(X_val, label=y_val, reference=dtrain)
            params = {
                "objective": "regression",
                "metric": "rmse",
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
                lgb.log_evaluation(period=100),
            ]
            self._model = lgb.train(
                params,
                dtrain,
                num_boost_round=mc.n_estimators,
                valid_sets=[dval],
                callbacks=callbacks,
            )
            logger.info(
                "LightGBM TrajectoryModel trained, best_iteration=%d",
                self._model.best_iteration,
            )
        else:
            from sklearn.ensemble import GradientBoostingRegressor
            self._model = GradientBoostingRegressor(
                n_estimators=mc.n_estimators,
                learning_rate=mc.learning_rate,
                max_leaf_nodes=mc.num_leaves,
                min_samples_leaf=mc.min_child_samples,
                subsample=mc.subsample,
                random_state=mc.random_state,
                verbose=0,
            )
            self._model.fit(X_train, y_train)
            logger.info("GradientBoostingRegressor TrajectoryModel trained (lightgbm not available)")

        return self

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Raw model prediction (moisture at horizon)."""
        Xf = X[self.feature_cols].astype(np.float32)
        if _LGBM_AVAILABLE:
            return self._model.predict(Xf, num_iteration=self._model.best_iteration)
        return self._model.predict(Xf)

    def predict_with_bias(self, X: pd.DataFrame, plant_instance_id: int) -> np.ndarray:
        preds = self.predict(X)
        bias = self._per_plant_bias.get(int(plant_instance_id), 0.0)
        return preds + bias

    # ── Per-plant bias calibration ────────────────────────────────────────────

    def calibrate_plant_bias(
        self,
        plant_df: pd.DataFrame,
        plant_instance_id: int,
        min_events: int = 2,
    ) -> float:
        """
        Compute additive bias correction for a specific plant.
        Uses residuals from past predictions vs actuals.
        Returns the bias value.
        """
        target_horizon = "moisture_at_horizon"
        valid = plant_df.dropna(subset=[target_horizon])
        if len(valid) < min_events:
            logger.debug(
                "Plant %d: not enough data for calibration (%d rows)",
                plant_instance_id, len(valid),
            )
            return 0.0

        preds = self.predict(valid)
        residuals = valid[target_horizon].values - preds
        bias = float(np.mean(residuals))
        self._per_plant_bias[int(plant_instance_id)] = bias
        logger.info(
            "Plant %d bias calibrated: %.4f (from %d samples)",
            plant_instance_id, bias, len(valid),
        )
        return bias

    # ── Time-to-threshold inference ───────────────────────────────────────────

    def find_time_to_threshold(
        self,
        current_features: pd.Series,
        low_threshold: float,
        steps_per_hour: float = 6.0,
    ) -> Tuple[Optional[float], float]:
        """
        Given the current feature row, predict moisture at horizon and
        linearly interpolate to find when moisture crosses low_threshold.

        Returns (hours_to_threshold, predicted_moisture_at_horizon)
        Returns (None, ...) if moisture never crosses threshold within horizon.
        """
        horizon_steps = self.cfg.trajectory_model.horizon_steps
        horizon_hours = horizon_steps / steps_per_hour

        # Predict moisture at horizon
        X = pd.DataFrame([current_features])
        pred_h = float(self.predict(X)[0])
        current_moisture = float(current_features.get("soil_moisture", pred_h))

        if pred_h >= low_threshold:
            # Moisture stays above threshold for the whole horizon
            return None, pred_h

        if current_moisture <= low_threshold:
            # Already below threshold – water now
            return 0.0, pred_h

        # Linear interpolation to find crossing time
        # m(t) = current_moisture + (pred_h - current_moisture) * (t / horizon_hours)
        # Solve for t when m(t) = low_threshold
        slope = (pred_h - current_moisture) / horizon_hours
        if abs(slope) < 1e-9:
            return None, pred_h
        hours = (low_threshold - current_moisture) / slope
        hours = float(np.clip(hours, 0.0, horizon_hours))
        return hours, pred_h

    # ── Persistence ──────────────────────────────────────────────────────────

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        logger.info("TrajectoryModel saved to %s", path)

    @classmethod
    def load(cls, path: Path) -> "TrajectoryModel":
        with open(path, "rb") as f:
            obj = pickle.load(f)
        logger.info("TrajectoryModel loaded from %s", path)
        return obj

