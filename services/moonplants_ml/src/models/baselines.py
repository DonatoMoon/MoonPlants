"""
Baseline models for MoonPlants ML.

Baselines are deliberately simple:
  - Time baseline: predict mean interval between waterings per species (or plant)
  - Amount baseline: predict median amount_ml per species (or plant)

These establish a performance floor that ML models must beat.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class TimeBaseline:
    """
    Predict time-to-next-watering as the historical mean interval
    between watering events, looked up by plant_instance_id first,
    then species_id, then global mean as fallback.
    """

    def __init__(self) -> None:
        self._plant_mean_hours: Dict[int, float] = {}
        self._species_mean_hours: Dict[int, float] = {}
        self._global_mean_hours: float = 0.0

    def fit(self, watering_events: pd.DataFrame) -> "TimeBaseline":
        """
        Compute mean inter-event intervals.

        Parameters
        ----------
        watering_events : pd.DataFrame
            Must have timestamp_utc (datetime), plant_instance_id, species_id.
        """
        all_intervals: list[float] = []

        for pid, grp in watering_events.groupby("plant_instance_id"):
            times = grp["timestamp_utc"].sort_values()
            if len(times) >= 2:
                diffs_h = pd.Series(times.values).diff().dropna().dt.total_seconds() / 3600
                mean_h = diffs_h.mean()
                self._plant_mean_hours[pid] = mean_h
                all_intervals.extend(diffs_h.tolist())
            elif len(times) == 1:
                # Only one event – use species benchmark
                pass

        for sid, grp in watering_events.groupby("species_id"):
            times = grp["timestamp_utc"].sort_values()
            if len(times) >= 2:
                diffs_h = pd.Series(times.values).diff().dropna().dt.total_seconds() / 3600
                self._species_mean_hours[sid] = diffs_h.mean()

        self._global_mean_hours = float(np.mean(all_intervals)) if all_intervals else 24.0 * 7
        logger.info(
            "TimeBaseline fitted. Plants: %d, Species: %d, global_mean_h=%.1f",
            len(self._plant_mean_hours),
            len(self._species_mean_hours),
            self._global_mean_hours,
        )
        return self

    def predict(
        self,
        plant_instance_id: int,
        species_id: Optional[int] = None,
    ) -> float:
        """Return predicted hours to next watering."""
        if plant_instance_id in self._plant_mean_hours:
            return self._plant_mean_hours[plant_instance_id]
        if species_id is not None and species_id in self._species_mean_hours:
            return self._species_mean_hours[species_id]
        return self._global_mean_hours

    def predict_batch(self, df: pd.DataFrame) -> np.ndarray:
        """Vectorised prediction over a DataFrame with plant_instance_id / species_id."""
        return np.array([
            self.predict(
                int(row.plant_instance_id),
                int(row.species_id) if "species_id" in df.columns else None,
            )
            for row in df.itertuples(index=False)
        ])


class AmountBaseline:
    """
    Predict watering amount as the historical median amount_ml,
    looked up by plant_instance_id → species_id → global.
    """

    def __init__(self) -> None:
        self._plant_median_ml: Dict[int, float] = {}
        self._species_median_ml: Dict[int, float] = {}
        self._global_median_ml: float = 0.0

    def fit(self, watering_events: pd.DataFrame) -> "AmountBaseline":
        for pid, grp in watering_events.groupby("plant_instance_id"):
            self._plant_median_ml[int(pid)] = float(grp["amount_ml"].median())

        for sid, grp in watering_events.groupby("species_id"):
            self._species_median_ml[int(sid)] = float(grp["amount_ml"].median())

        self._global_median_ml = float(watering_events["amount_ml"].median())
        logger.info(
            "AmountBaseline fitted. Plants: %d, Species: %d, global_median_ml=%.1f",
            len(self._plant_median_ml),
            len(self._species_median_ml),
            self._global_median_ml,
        )
        return self

    def predict(
        self,
        plant_instance_id: int,
        species_id: Optional[int] = None,
    ) -> float:
        if plant_instance_id in self._plant_median_ml:
            return self._plant_median_ml[plant_instance_id]
        if species_id is not None and species_id in self._species_median_ml:
            return self._species_median_ml[species_id]
        return self._global_median_ml

    def predict_batch(self, df: pd.DataFrame) -> np.ndarray:
        return np.array([
            self.predict(
                int(row.plant_instance_id),
                int(row.species_id) if "species_id" in df.columns else None,
            )
            for row in df.itertuples(index=False)
        ])

