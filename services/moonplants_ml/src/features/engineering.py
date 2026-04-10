"""
Feature engineering for MoonPlants ML.

Builds the master feature DataFrame from raw readings + metadata.
Key design principle: ALL features are computed from past data only
(no future leakage) by using shift(1) before rolling operations.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Merge metadata onto readings
# ─────────────────────────────────────────────────────────────────────────────

def merge_metadata(
    readings: pd.DataFrame,
    plant_instances: pd.DataFrame,
    species: pd.DataFrame,
) -> pd.DataFrame:
    """
    Left-join plant_instances and species onto readings.
    Adds pot/species features needed for modelling.
    """
    instance_cols = [
        "plant_instance_id", "species_id", "pot_volume_ml",
        "soil_retention_factor", "drainage_factor",
        "sensor_dry_raw", "sensor_wet_raw",
        "baseline_air_temp_c", "baseline_air_humidity_pct",
    ]
    species_cols = [
        "species_id", "watering_benchmark_days_min", "watering_benchmark_days_max",
        "watering_category_num", "drought_tolerant",
    ]

    inst = plant_instances[[c for c in instance_cols if c in plant_instances.columns]].copy()
    spec = species[[c for c in species_cols if c in species.columns]].copy()

    # species_id already in readings, drop it from inst to avoid duplicate
    inst = inst.drop(columns=["species_id"], errors="ignore")

    df = readings.merge(inst, on="plant_instance_id", how="left")
    df = df.merge(spec, on="species_id", how="left")

    # Derived species prior thresholds
    # low threshold ≈ 25% of wet range (conservative for moisture-sensitive plants)
    df["species_watering_benchmark_days_mid"] = (
        df["watering_benchmark_days_min"] + df["watering_benchmark_days_max"]
    ) / 2.0
    df["drought_tolerant_flag"] = df["drought_tolerant"].astype(float)

    return df


# ─────────────────────────────────────────────────────────────────────────────
# 2. Temporal / calendar features
# ─────────────────────────────────────────────────────────────────────────────

def add_calendar_features(df: pd.DataFrame, cfg: Config = DEFAULT_CONFIG) -> pd.DataFrame:
    """Add hour_of_day, day_of_week, is_daylight, day_of_month."""
    ts = df["timestamp_utc"].dt
    df["hour_of_day"] = ts.hour + ts.minute / 60.0
    df["day_of_week"] = ts.dayofweek          # 0=Monday … 6=Sunday
    df["day_of_month"] = ts.day
    df["is_daylight"] = (
        (ts.hour >= cfg.features.daylight_start_hour) &
        (ts.hour < cfg.features.daylight_end_hour)
    ).astype(float)
    # Cyclical encoding of hour and dow to preserve periodicity
    df["hour_sin"] = np.sin(2 * np.pi * df["hour_of_day"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour_of_day"] / 24.0)
    df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7.0)
    df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7.0)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 3. Environmental derived features
# ─────────────────────────────────────────────────────────────────────────────

def add_env_features(df: pd.DataFrame, cfg: Config = DEFAULT_CONFIG) -> pd.DataFrame:
    """
    VPD proxy (kPa) using the Magnus formula:
        SVP(T) = 0.6108 * exp(a*T / (b+T))
        VPD = SVP * (1 - RH/100)
    Also adds a heat-load proxy: air_temp * (1 - air_humidity/100) * light_lux_norm
    """
    a = cfg.features.vpd_magnus_a
    b = cfg.features.vpd_magnus_b
    T = df["air_temperature_c"]
    RH = df["air_humidity_pct"]
    svp = 0.6108 * np.exp(a * T / (b + T))
    df["vpd_kpa"] = svp * (1.0 - RH / 100.0)

    # Normalised light (0..1 within dataset range) for heat-load proxy
    lux_max = df["light_lux"].max()
    if lux_max > 0:
        df["light_norm"] = df["light_lux"] / lux_max
    else:
        df["light_norm"] = 0.0

    df["heat_load_proxy"] = df["air_temperature_c"] * df["light_norm"]
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 4. Lag & rolling features on soil_moisture (per plant, no leakage)
# ─────────────────────────────────────────────────────────────────────────────

def add_moisture_lag_rolling(
    df: pd.DataFrame,
    watering_events: Optional[pd.DataFrame] = None,
    cfg: Config = DEFAULT_CONFIG,
) -> pd.DataFrame:
    """
    For each plant independently compute:
     - Lag features: soil_moisture at t-k steps
     - Rolling mean/std/min over window sizes (minutes → steps = minutes/10)
     - steps_since_last_watering derived from watering_events (not readings)
    All rolling ops are applied on the SHIFTED series to prevent leakage.
    """
    steps_per_minute = 1.0 / 10.0  # 1 reading per 10 min

    # Build lookup: plant_id → sorted event timestamps (UTC numpy array)
    event_ts_by_plant: dict = {}
    if watering_events is not None and not watering_events.empty:
        for pid, grp in watering_events.groupby("plant_instance_id"):
            event_ts_by_plant[pid] = (
                pd.to_datetime(grp["timestamp_utc"], utc=True)
                .sort_values()
                .values
            )

    groups = []
    for pid, grp in df.groupby("plant_instance_id", sort=False):
        grp = grp.copy()
        sm = grp["soil_moisture"]

        # Lag features (shift by k steps into past)
        for k in cfg.features.lag_steps:
            grp[f"moisture_lag_{k}"] = sm.shift(k)

        # Drying rate (finite difference, past 1 step)
        grp["moisture_delta_1step"] = sm.shift(1) - sm.shift(2)

        # Rolling statistics (no future leakage: shift(1) before rolling)
        sm_shifted = sm.shift(1)
        for win_min in cfg.features.rolling_windows_minutes:
            win_steps = max(1, int(win_min * steps_per_minute))
            win_lbl = f"{win_min}min"
            roll = sm_shifted.rolling(window=win_steps, min_periods=1)
            grp[f"moisture_roll_mean_{win_lbl}"] = roll.mean()
            grp[f"moisture_roll_std_{win_lbl}"]  = roll.std().fillna(0.0)
            grp[f"moisture_roll_min_{win_lbl}"]  = roll.min()

        # Rolling VPD mean (evaporation pressure)
        if "vpd_kpa" in grp.columns:
            vpd_shifted = grp["vpd_kpa"].shift(1)
            for win_min in [60, 360]:
                win_steps = max(1, int(win_min * steps_per_minute))
                grp[f"vpd_roll_mean_{win_min}min"] = (
                    vpd_shifted.rolling(win_steps, min_periods=1).mean()
                )

        # ── Steps since last watering (from watering_events, no leakage) ─────
        # For each reading at time t, find the last event STRICTLY before t
        # using searchsorted, then compute elapsed steps.
        event_times = event_ts_by_plant.get(pid, None)
        if event_times is not None and len(event_times) > 0:
            ts_vals = grp["timestamp_utc"].values  # UTC numpy datetime64
            # Find index of last event before each ts (side="left" → strictly before)
            idx = np.searchsorted(event_times, ts_vals, side="left") - 1
            has_prior = idx >= 0
            safe_idx = np.maximum(idx, 0)
            # Elapsed seconds → steps (10-min each)
            elapsed_s = np.where(
                has_prior,
                (ts_vals.astype("datetime64[s]").astype(np.int64)
                 - event_times[safe_idx].astype("datetime64[s]").astype(np.int64)),
                np.nan,
            )
            grp["steps_since_last_watering"] = np.where(
                has_prior,
                (elapsed_s / 600.0).astype(float),   # 600s = 10 min per step
                np.nan,
            )
            # Hours since last watering (more informative for long intervals)
            grp["hours_since_last_watering"] = np.where(
                has_prior,
                (elapsed_s / 3600.0).astype(float),
                np.nan,
            )
        else:
            grp["steps_since_last_watering"] = np.nan
            grp["hours_since_last_watering"] = np.nan

        groups.append(grp)

    df_out = pd.concat(groups, ignore_index=True)
    df_out = df_out.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# 5. Target: hours to next watering event (for TTE model)
# ─────────────────────────────────────────────────────────────────────────────

def add_tte_target(
    df: pd.DataFrame,
    watering_events: pd.DataFrame,
    cfg: Config = DEFAULT_CONFIG,
) -> pd.DataFrame:
    """
    For each reading, compute hours until the NEXT watering event.
    Rows with no future watering event (last segment) get NaN.
    """
    groups = []
    events_by_plant = watering_events.groupby("plant_instance_id")

    for pid, grp in df.groupby("plant_instance_id", sort=False):
        grp = grp.copy()
        if pid not in events_by_plant.groups:
            grp["hours_to_next_watering"] = np.nan
            groups.append(grp)
            continue

        event_times = (
            events_by_plant.get_group(pid)["timestamp_utc"]
            .sort_values()
            .values
        )

        # For each reading timestamp, find next event time using searchsorted
        ts_array = grp["timestamp_utc"].values
        # searchsorted returns index of first event AFTER current ts
        idx = np.searchsorted(event_times, ts_array, side="right")
        valid_mask = idx < len(event_times)
        # Clamp idx so we can index safely; invalid positions are masked by np.where
        safe_idx = np.minimum(idx, len(event_times) - 1)
        # Use timedelta64[s] arithmetic to avoid timezone-offset int64 issues
        delta_s = (event_times[safe_idx].astype("datetime64[s]")
                   - ts_array.astype("datetime64[s]")).astype(np.float64)
        hours = np.where(valid_mask, delta_s / 3600.0, np.nan)
        grp["hours_to_next_watering"] = hours
        groups.append(grp)

    df_out = pd.concat(groups, ignore_index=True)
    df_out = df_out.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# 6. Target: moisture at horizon H (for trajectory model)
# ─────────────────────────────────────────────────────────────────────────────

def add_trajectory_target(
    df: pd.DataFrame, cfg: Config = DEFAULT_CONFIG
) -> pd.DataFrame:
    """
    For each reading at time t, add soil_moisture at t + horizon_steps.
    Computed per-plant (forward shift); rows near end of series get NaN.
    """
    h = cfg.trajectory_model.horizon_steps
    groups = []
    for pid, grp in df.groupby("plant_instance_id", sort=False):
        grp = grp.copy()
        grp["moisture_at_horizon"] = grp["soil_moisture"].shift(-h)
        groups.append(grp)
    df_out = pd.concat(groups, ignore_index=True)
    df_out = df_out.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    return df_out


# ─────────────────────────────────────────────────────────────────────────────
# 7. Master feature pipeline
# ─────────────────────────────────────────────────────────────────────────────

def build_features(
    readings: pd.DataFrame,
    watering_events: pd.DataFrame,
    plant_instances: pd.DataFrame,
    species: pd.DataFrame,
    cfg: Config = DEFAULT_CONFIG,
    add_targets: bool = True,
) -> pd.DataFrame:
    """
    Full feature engineering pipeline. Returns the enriched DataFrame.
    Set add_targets=False for pure inference (no future data available).
    """
    logger.info("Building features for %d readings ...", len(readings))

    df = merge_metadata(readings, plant_instances, species)
    df = add_calendar_features(df, cfg)
    df = add_env_features(df, cfg)
    df = add_moisture_lag_rolling(df, watering_events=watering_events, cfg=cfg)

    if add_targets:
        df = add_tte_target(df, watering_events, cfg)
        df = add_trajectory_target(df, cfg)

    logger.info(
        "Features built: %d rows, %d columns", len(df), df.shape[1]
    )
    return df


def save_features(df: pd.DataFrame, cfg: Config = DEFAULT_CONFIG) -> None:
    """Persist feature DataFrame to parquet for caching."""
    out = cfg.data.features_cache
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    logger.info("Features cached to %s", out)


def load_features_cache(cfg: Config = DEFAULT_CONFIG) -> Optional[pd.DataFrame]:
    """Load cached features if available."""
    path = cfg.data.features_cache
    if path.exists():
        logger.info("Loading features from cache: %s", path)
        return pd.read_parquet(path)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 8. Feature column lists (shared by models)
# ─────────────────────────────────────────────────────────────────────────────

def get_base_feature_cols(df: pd.DataFrame) -> list[str]:
    """
    Return the list of feature columns common to both models
    (excludes targets and raw ID/timestamp cols).
    """
    exclude = {
        "timestamp_utc", "device_id",
        "soil_moisture",           # current target / raw sensor
        "soil_moisture_raw",
        "is_watering_event",
        "watering_amount_ml",
        "hours_to_next_watering",  # TTE target
        "moisture_at_horizon",     # trajectory target
        "api_json",
    }
    return [c for c in df.columns if c not in exclude]

