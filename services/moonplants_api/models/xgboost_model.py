"""
XGBoost model wrapper — matches the class pickled by research_v2 notebooks.
Must stay structurally identical to research_v2/src/models/xgboost_model.py so
pickle.load() resolves to the correct class definition.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb


class XGBModel:
    DEFAULT_PARAMS = {
        "objective": "reg:absoluteerror",
        "eval_metric": "mae",
        "tree_method": "hist",
        "device": "cpu",
        "seed": 42,
        "nthread": -1,
    }

    def __init__(self, params: dict | None = None) -> None:
        self.params = {**self.DEFAULT_PARAMS, **(params or {})}
        self.model: xgb.Booster | None = None
        self.feature_cols: list[str] = []
        self.best_params: dict = {}

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        assert self.model is not None, "Model not loaded"
        dtest = xgb.DMatrix(X[self.feature_cols].fillna(0))
        return self.model.predict(dtest)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: Path) -> "XGBModel":
        with open(path, "rb") as f:
            return pickle.load(f)
