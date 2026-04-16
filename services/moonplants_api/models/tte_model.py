"""
Approach B: Direct Time-To-Event Model
- Trains one LightGBM regressor to predict hours_to_next_watering directly.
- Simpler to evaluate but less interpretable than trajectory approach.
- Both models are trained and compared in the pipeline.
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
    "hours_to_next_watering",   # target
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


class TimeToEventModel:
    """
    Directly regresses hours_to_next_watering from current sensor state.
    """

    def __init__(self, cfg: Config = DEFAULT_CONFIG) -> None:
        self.cfg = cfg
        self.feature_cols: List[str] = []
        self._model = None
        self._per_plant_bias: dict[int, float] = {}

    def fit(
        self,
        train: pd.DataFrame,
        val: pd.DataFrame,
    ) -> "TimeToEventModel":
        target = "hours_to_next_watering"
        mc = self.cfg.tte_model

        # Drop NaN targets and rows DURING a watering event (TTE=0 is not useful for regression)
        train_c = train.dropna(subset=[target]).copy()
        val_c   = val.dropna(subset=[target]).copy()

        # Cap extreme TTE values (physical upper bound from config)
        train_c[target] = train_c[target].clip(upper=mc.max_hours)
        val_c[target]   = val_c[target].clip(upper=mc.max_hours)

        self.feature_cols = _get_feature_cols(train_c)
        logger.info("TimeToEventModel: %d features", len(self.feature_cols))

        X_train = train_c[self.feature_cols].astype(np.float32)
        y_train = train_c[target].astype(np.float32)
        X_val   = val_c[self.feature_cols].astype(np.float32)
        y_val   = val_c[target].astype(np.float32)

        if _LGBM_AVAILABLE:
            dtrain = lgb.Dataset(X_train, label=y_train)
            dval   = lgb.Dataset(X_val, label=y_val, reference=dtrain)
            params = {
                "objective": "regression",
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
                "LightGBM TimeToEventModel trained, best_iteration=%d",
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
            )
            self._model.fit(X_train, y_train)

        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        Xf = X[self.feature_cols].astype(np.float32)
        if _LGBM_AVAILABLE:
            raw = self._model.predict(Xf, num_iteration=self._model.best_iteration)
        else:
            raw = self._model.predict(Xf)
        return np.clip(raw, 0.0, self.cfg.tte_model.max_hours)

    def predict_with_bias(self, X: pd.DataFrame, plant_instance_id: int) -> np.ndarray:
        preds = self.predict(X)
        bias = self._per_plant_bias.get(int(plant_instance_id), 0.0)
        return np.clip(preds + bias, 0.0, self.cfg.tte_model.max_hours)

    def calibrate_plant_bias(
        self,
        plant_df: pd.DataFrame,
        plant_instance_id: int,
        min_events: int = 2,
    ) -> float:
        target = "hours_to_next_watering"
        valid = plant_df.dropna(subset=[target])
        if len(valid) < min_events:
            return 0.0
        preds = self.predict(valid)
        residuals = valid[target].values - preds
        bias = float(np.mean(residuals))
        self._per_plant_bias[int(plant_instance_id)] = bias
        logger.info("Plant %d TTE bias: %.2f h", plant_instance_id, bias)
        return bias

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        logger.info("TimeToEventModel saved to %s", path)

    @classmethod
    def load(cls, path: Path) -> "TimeToEventModel":
        with open(path, "rb") as f:
            obj = pickle.load(f)
        logger.info("TimeToEventModel loaded from %s", path)
        return obj

