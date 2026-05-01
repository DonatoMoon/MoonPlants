"""
LightGBM model wrapper — matches the class pickled by research_v2 notebooks.
Must stay structurally identical to research_v2/src/models/lgbm_model.py so
pickle.load() resolves to the correct class definition.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb


class LGBMModel:
    DEFAULT_PARAMS = {
        "objective": "regression_l1",
        "metric": "mae",
        "verbosity": -1,
        "boosting_type": "gbdt",
        "device": "cpu",
        "n_jobs": -1,
        "seed": 42,
    }

    def __init__(self, params: dict | None = None) -> None:
        self.params = {**self.DEFAULT_PARAMS, **(params or {})}
        self.model: lgb.Booster | None = None
        self.feature_cols: list[str] = []
        self.best_params: dict = {}

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        assert self.model is not None, "Model not loaded"
        return self.model.predict(X[self.feature_cols].fillna(0))

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: Path) -> "LGBMModel":
        with open(path, "rb") as f:
            return pickle.load(f)
