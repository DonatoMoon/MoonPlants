"""
Feature engineering for MoonPlants ML.

Mirrors research_v2/src/features/engineering.py exactly so that column names
produced here match the feature_cols stored inside the trained pkl models.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

LAG_STEPS = [1, 3, 6, 12, 18, 36, 72, 144]
LAG_NAMES  = ["10min", "30min", "1h", "2h", "3h", "6h", "12h", "24h"]
ROLLING_WINDOWS = {"1h": 6, "6h": 36, "24h": 144}
DAYLIGHT_START_UTC = 6
DAYLIGHT_END_UTC   = 20
MAGNUS_A = 17.625
MAGNUS_B = 243.04
MAX_LUX  = 100_000
WATERING_CATEGORY_MAP = {"Minimum": 0, "Average": 1, "Frequent": 2}

_META_COLS_PLANTS = [
    "plant_instance_id", "pot_volume_ml", "soil_retention_factor",
    "drainage_factor", "baseline_air_temp_c", "baseline_air_humidity_pct",
]
_META_COLS_SPECIES = [
    "species_id", "watering_category", "benchmark_days_min",
    "drought_tolerant", "water_threshold",
]


def add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    ts   = df["timestamp_utc"]
    hour = ts.dt.hour + ts.dt.minute / 60.0
    dow  = ts.dt.dayofweek.astype(float)
    df["hour_sin"]    = np.sin(2 * np.pi * hour / 24)
    df["hour_cos"]    = np.cos(2 * np.pi * hour / 24)
    df["dow_sin"]     = np.sin(2 * np.pi * dow / 7)
    df["dow_cos"]     = np.cos(2 * np.pi * dow / 7)
    df["is_daylight"] = (
        (ts.dt.hour >= DAYLIGHT_START_UTC) & (ts.dt.hour < DAYLIGHT_END_UTC)
    ).astype(np.int8)
    df["day_of_month"] = ts.dt.day.astype(np.int16)
    return df


def add_vpd_features(df: pd.DataFrame) -> pd.DataFrame:
    df  = df.copy()
    T   = df["air_temperature_c"]
    RH  = df["air_humidity_pct"] / 100.0
    es  = 0.61078 * np.exp(MAGNUS_A * T / (MAGNUS_B + T))
    ea  = es * RH
    df["vpd_kpa"] = (es - ea).clip(lower=0.0)
    return df


def add_moisture_dynamics(df: pd.DataFrame) -> pd.DataFrame:
    df  = df.copy()
    grp = df.groupby("plant_instance_id", sort=False)["soil_moisture"]
    df["moisture_speed"] = grp.transform(lambda x: x.diff(1))
    df["moisture_acceleration"] = (
        df.groupby("plant_instance_id", sort=False)["moisture_speed"]
        .transform(lambda x: x.diff(1))
    )
    df["light_norm"]       = (df["light_lux"] / MAX_LUX).clip(0.0, 1.0)
    df["heat_load_proxy"]  = (
        df["air_temperature_c"]
        * (1.0 - df["air_humidity_pct"] / 100.0)
        * df["light_norm"]
    )
    return df


def add_moisture_lags(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for steps, name in zip(LAG_STEPS, LAG_NAMES):
        df[f"moisture_lag_{name}"] = (
            df.groupby("plant_instance_id", sort=False)["soil_moisture"]
            .transform(lambda x, s=steps: x.shift(s))
        )
    return df


def add_rolling_stats(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for win_name, w in ROLLING_WINDOWS.items():
        for stat in ("mean", "std", "min"):
            min_p = 2 if stat == "std" else 1
            col   = f"moisture_roll_{stat}_{win_name}"
            df[col] = (
                df.groupby("plant_instance_id", sort=False)["soil_moisture"]
                .transform(
                    lambda x, w=w, stat=stat, min_p=min_p: getattr(
                        x.shift(1).rolling(w, min_periods=min_p), stat
                    )()
                )
            )
    for win_name, w in (("1h", 6), ("6h", 36)):
        df[f"vpd_roll_mean_{win_name}"] = (
            df.groupby("plant_instance_id", sort=False)["vpd_kpa"]
            .transform(lambda x, w=w: x.shift(1).rolling(w, min_periods=1).mean())
        )
    return df


def add_time_since_event(
    df: pd.DataFrame,
    watering_events: pd.DataFrame,
) -> pd.DataFrame:
    df = df.copy()
    df["hours_since_last_watering"] = np.nan
    df["steps_since_last_watering"] = np.nan

    for pid in df["plant_instance_id"].unique():
        plant_events = (
            watering_events[watering_events["plant_instance_id"] == pid]
            .sort_values("timestamp_utc")
        )
        mask = df["plant_instance_id"] == pid
        if plant_events.empty:
            continue
        event_times = plant_events["timestamp_utc"].values.astype("datetime64[ns]")
        row_times   = df.loc[mask, "timestamp_utc"].values.astype("datetime64[ns]")
        idx   = np.searchsorted(event_times, row_times, side="right") - 1
        valid = idx >= 0
        hours = np.where(
            valid,
            (row_times - event_times[np.maximum(idx, 0)]).astype(np.int64) / 1e9 / 3600.0,
            np.nan,
        )
        df.loc[mask, "hours_since_last_watering"] = hours
        df.loc[mask, "steps_since_last_watering"]  = np.where(
            valid, (hours * 6.0).round(), np.nan
        )
    return df


def add_plant_metadata(
    df: pd.DataFrame,
    plant_instances: pd.DataFrame,
    species: pd.DataFrame,
) -> pd.DataFrame:
    df = df.merge(plant_instances[_META_COLS_PLANTS], on="plant_instance_id", how="left")
    df = df.merge(species[_META_COLS_SPECIES], on="species_id", how="left")
    df["watering_category_num"] = (
        df["watering_category"].map(WATERING_CATEGORY_MAP).astype(float)
    )
    df["drought_tolerant_flag"] = (
        df["drought_tolerant"]
        .map({"True": 1, "False": 0, True: 1, False: 0})
        .astype(float)
    )
    df = df.drop(columns=["watering_category", "drought_tolerant"], errors="ignore")
    return df


def build_features(
    readings: pd.DataFrame,
    watering_events: pd.DataFrame,
    plant_instances: pd.DataFrame,
    species: pd.DataFrame,
    cfg=None,           # kept for call-site compatibility; not used
    add_targets: bool = True,
) -> pd.DataFrame:
    logger.info("Building features for %d readings ...", len(readings))
    df = readings.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    df = add_calendar_features(df)
    df = add_vpd_features(df)
    df = add_moisture_dynamics(df)
    df = add_moisture_lags(df)
    df = add_rolling_stats(df)
    df = add_time_since_event(df, watering_events)
    df = add_plant_metadata(df, plant_instances, species)
    logger.info("Features built: %d rows, %d columns", len(df), df.shape[1])
    return df
