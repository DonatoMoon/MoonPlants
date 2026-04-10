"""
Unit tests for MoonPlants ML — critical functions.
Run with:  pytest tests/ -v   (from the repo root)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# ── Make src importable without install ──────────────────────────────────────
SRC = Path(__file__).resolve().parent.parent / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config import DEFAULT_CONFIG
from data.validators import validate_readings, validate_watering_events
from evaluation.metrics import (
    mae_hours, mape_hours, hit_rate, tte_metrics,
    amount_metrics, trajectory_metrics,
)
from features.engineering import (
    add_calendar_features, add_env_features,
    add_moisture_lag_rolling, add_tte_target,
)
from features.splitting import time_split
from models.baselines import TimeBaseline, AmountBaseline


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_readings(n: int = 200, n_plants: int = 2) -> pd.DataFrame:
    """Create a synthetic readings DataFrame for tests."""
    rng = np.random.default_rng(42)
    per = n // n_plants
    records = []
    for pid in range(1, n_plants + 1):
        ts = pd.date_range("2026-02-01", periods=per, freq="10min", tz="UTC")
        records.append(pd.DataFrame({
            "timestamp_utc": ts,
            "plant_instance_id": pid,
            "species_id": 728,
            "device_id": f"dev_{pid}",
            "soil_moisture": np.clip(
                0.7 - np.arange(per) * 0.003 + rng.normal(0, 0.01, per), 0.05, 0.99
            ),
            "soil_moisture_raw": rng.integers(300, 800, per),
            "soil_temperature_c": rng.uniform(18, 25, per),
            "air_temperature_c": rng.uniform(18, 26, per),
            "air_humidity_pct": rng.uniform(30, 70, per),
            "light_lux": np.abs(rng.normal(3000, 1500, per)),
            # NOTE: no is_watering_event / watering_amount_ml — separate table
        }))
    df = pd.concat(records, ignore_index=True)
    df = df.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    return df


def _make_watering_events(n_plants: int = 2) -> pd.DataFrame:
    rows = []
    for pid in range(1, n_plants + 1):
        for d in [5, 12, 19]:
            rows.append({
                "event_id": len(rows) + 1,
                "timestamp_utc": pd.Timestamp(f"2026-02-{d:02d}T10:00:00+00:00"),
                "plant_instance_id": pid,
                "species_id": 728,
                "amount_ml": 300.0,
                "moisture_before": 0.22,
                "moisture_after": 0.65,
                "target_moisture": 0.65,
                "runoff_fraction": 0.5,
                "reason": "scheduled",
            })
    return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Validators
# ─────────────────────────────────────────────────────────────────────────────

class TestValidators:
    def test_readings_valid(self):
        df = _make_readings()
        report = validate_readings(df)
        assert report.is_valid, report.summary()

    def test_readings_detects_duplicates(self):
        df = _make_readings(100, 1)
        df_dup = pd.concat([df, df.iloc[:5]], ignore_index=True)
        report = validate_readings(df_dup)
        assert not report.is_valid
        assert any("Duplicate" in e for e in report.errors)

    def test_readings_detects_out_of_range_moisture(self):
        df = _make_readings(100, 1)
        df.loc[0, "soil_moisture"] = 1.5
        report = validate_readings(df)
        assert any("soil_moisture" in w for w in report.warnings)

    def test_watering_events_valid(self):
        ev = _make_watering_events()
        report = validate_watering_events(ev)
        assert report.is_valid

    def test_watering_events_detects_negative_amount(self):
        ev = _make_watering_events()
        ev.loc[0, "amount_ml"] = -10.0
        report = validate_watering_events(ev)
        assert not report.is_valid


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Feature engineering (no-leakage invariants)
# ─────────────────────────────────────────────────────────────────────────────

class TestFeatureEngineering:
    def test_calendar_features_shape(self):
        df = _make_readings(100, 1)
        out = add_calendar_features(df)
        for col in ["hour_of_day", "day_of_week", "is_daylight", "hour_sin", "hour_cos"]:
            assert col in out.columns

    def test_env_features_vpd_nonnegative(self):
        df = _make_readings(100, 1)
        df = add_calendar_features(df)
        out = add_env_features(df)
        assert "vpd_kpa" in out.columns
        assert (out["vpd_kpa"] >= 0).all(), "VPD should be non-negative"

    def test_lag_features_no_leakage(self):
        """The lag-1 feature at row i must equal soil_moisture at row i-1."""
        df = _make_readings(50, 1)
        ev = _make_watering_events(1)
        df = add_calendar_features(df)
        df = add_env_features(df)
        out = add_moisture_lag_rolling(df, watering_events=ev)
        plant = out[out["plant_instance_id"] == 1].reset_index(drop=True)
        for i in range(2, min(10, len(plant))):
            expected = plant.loc[i - 1, "soil_moisture"]
            actual   = plant.loc[i, "moisture_lag_1"]
            assert abs(expected - actual) < 1e-9, (
                f"Leakage detected at row {i}: lag_1={actual} != prev_moisture={expected}"
            )

    def test_tte_target_nonnegative(self):
        df = _make_readings(200, 2)
        ev = _make_watering_events(2)
        df = add_calendar_features(df)
        df = add_env_features(df)
        df = add_moisture_lag_rolling(df, watering_events=ev)
        out = add_tte_target(df, ev)
        valid = out["hours_to_next_watering"].dropna()
        assert (valid >= 0).all(), "TTE values must be non-negative"

    def test_tte_no_future_leakage(self):
        """TTE at time t must not use information from after t."""
        df = _make_readings(200, 1)
        ev = _make_watering_events(1)
        df = add_calendar_features(df)
        df = add_env_features(df)
        df = add_moisture_lag_rolling(df, watering_events=ev)
        out = add_tte_target(df, ev)
        plant = out[out["plant_instance_id"] == 1].sort_values("timestamp_utc")
        last_event_ts = ev[ev["plant_instance_id"] == 1]["timestamp_utc"].max()
        after_last = plant[plant["timestamp_utc"] > last_event_ts]
        assert after_last["hours_to_next_watering"].isna().all(), \
            "Rows after last event should have NaN TTE (no future events)"


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Time split
# ─────────────────────────────────────────────────────────────────────────────

class TestTimeSplit:
    def test_split_no_overlap(self):
        df = _make_readings(300, 2)
        ev = _make_watering_events(2)
        df = add_calendar_features(df)
        df = add_env_features(df)
        df = add_moisture_lag_rolling(df, watering_events=ev)
        train, val, test = time_split(df)
        assert train["timestamp_utc"].max() <= val["timestamp_utc"].min()
        assert val["timestamp_utc"].max() <= test["timestamp_utc"].min()

    def test_split_sizes(self):
        df = _make_readings(300, 1)
        ev = _make_watering_events(1)
        df = add_calendar_features(df)
        df = add_env_features(df)
        df = add_moisture_lag_rolling(df, watering_events=ev)
        train, val, test = time_split(df)
        total = len(train) + len(val) + len(test)
        assert total == len(df)
        assert len(train) > len(val)
        assert len(train) > len(test)


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Metrics
# ─────────────────────────────────────────────────────────────────────────────

class TestMetrics:
    def test_mae_perfect(self):
        y = np.array([10.0, 20.0, 30.0])
        assert mae_hours(y, y) == pytest.approx(0.0)

    def test_mae_known(self):
        y_true = np.array([10.0, 20.0])
        y_pred = np.array([12.0, 18.0])
        assert mae_hours(y_true, y_pred) == pytest.approx(2.0)

    def test_hit_rate_all_hit(self):
        y_true = np.array([10.0, 20.0, 30.0])
        y_pred = y_true + 5.0  # all within ±12h
        assert hit_rate(y_true, y_pred, window_hours=12.0) == pytest.approx(1.0)

    def test_hit_rate_none_hit(self):
        y_true = np.array([10.0, 20.0])
        y_pred = y_true + 20.0  # all outside ±12h
        assert hit_rate(y_true, y_pred, window_hours=12.0) == pytest.approx(0.0)

    def test_mape_known(self):
        y_true = np.array([100.0])
        y_pred = np.array([110.0])
        assert mape_hours(y_true, y_pred) == pytest.approx(10.0, abs=0.01)

    def test_tte_metrics_keys(self):
        y = np.array([5.0, 10.0, 15.0])
        m = tte_metrics(y, y + 1)
        assert "mae_hours" in m
        assert "mape_pct" in m
        assert any("hit_rate" in k for k in m)

    def test_trajectory_metrics_perfect(self):
        y = np.array([0.5, 0.4, 0.3])
        m = trajectory_metrics(y, y)
        assert m["mae"] == pytest.approx(0.0)
        assert m["rmse"] == pytest.approx(0.0)

    def test_amount_metrics_known(self):
        y_true = np.array([100.0, 200.0])
        y_pred = np.array([110.0, 190.0])
        m = amount_metrics(y_true, y_pred)
        assert m["mae_ml"] == pytest.approx(10.0)

    def test_nan_handling(self):
        y_true = np.array([10.0, np.nan, 30.0])
        y_pred = np.array([10.0, 20.0, 30.0])
        assert mae_hours(y_true, y_pred) == pytest.approx(0.0)


# ─────────────────────────────────────────────────────────────────────────────
# Tests: Baselines
# ─────────────────────────────────────────────────────────────────────────────

class TestBaselines:
    def test_time_baseline_fit_predict(self):
        ev = _make_watering_events(2)
        bl = TimeBaseline().fit(ev)
        # Plant 1: 3 events at days 5, 12, 19 → intervals ~168h each
        pred = bl.predict(plant_instance_id=1, species_id=728)
        assert 100 < pred < 250, f"Expected ~168h, got {pred}"

    def test_time_baseline_fallback_to_global(self):
        ev = _make_watering_events(2)
        bl = TimeBaseline().fit(ev)
        pred = bl.predict(plant_instance_id=999, species_id=999)
        assert pred > 0

    def test_amount_baseline_fit_predict(self):
        ev = _make_watering_events(2)
        bl = AmountBaseline().fit(ev)
        pred = bl.predict(plant_instance_id=1, species_id=728)
        assert abs(pred - 300.0) < 1e-6

    def test_amount_baseline_predict_batch(self):
        ev = _make_watering_events(2)
        bl = AmountBaseline().fit(ev)
        df = _make_readings(20, 2)[["plant_instance_id", "species_id"]].drop_duplicates()
        preds = bl.predict_batch(df)
        assert len(preds) == len(df)
        assert (preds > 0).all()

