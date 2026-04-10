"""
Data loaders for MoonPlants ML.
Each loader returns a clean, typed DataFrame sorted by time.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


def load_readings(cfg: Config = DEFAULT_CONFIG) -> pd.DataFrame:
    """
    Load 10-minute sensor readings.

    Returns
    -------
    pd.DataFrame
        Columns: timestamp_utc (datetime64[ns, UTC]), device_id,
        plant_instance_id, species_id, soil_moisture, soil_moisture_raw,
        soil_temperature_c, air_temperature_c, air_humidity_pct, light_lux.
        NOTE: watering events are stored separately in watering_events.csv.
        Sorted by (plant_instance_id, timestamp_utc).
    """
    path = Path(cfg.data.readings)
    logger.info("Loading readings from %s", path)
    df = pd.read_csv(path, parse_dates=["timestamp_utc"])
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
    df = df.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    logger.info("Readings loaded: %d rows, %d plants", len(df), df["plant_instance_id"].nunique())
    return df


def load_watering_events(cfg: Config = DEFAULT_CONFIG) -> pd.DataFrame:
    """
    Load watering events.

    Returns
    -------
    pd.DataFrame
        Columns: event_id, timestamp_utc (datetime64[ns, UTC]), plant_instance_id,
        species_id, reason, amount_ml, moisture_before, moisture_after,
        target_moisture, runoff_fraction
        Sorted by (plant_instance_id, timestamp_utc).
    """
    path = Path(cfg.data.watering_events)
    logger.info("Loading watering events from %s", path)
    df = pd.read_csv(path, parse_dates=["timestamp_utc"])
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
    df = df.sort_values(["plant_instance_id", "timestamp_utc"]).reset_index(drop=True)
    logger.info("Watering events loaded: %d rows", len(df))
    return df


def load_plant_instances(cfg: Config = DEFAULT_CONFIG) -> pd.DataFrame:
    """Load plant instance metadata."""
    path = Path(cfg.data.plant_instances)
    logger.info("Loading plant instances from %s", path)
    df = pd.read_csv(path)
    logger.info("Plant instances loaded: %d rows", len(df))
    return df


def load_species(cfg: Config = DEFAULT_CONFIG) -> pd.DataFrame:
    """Load species reference data."""
    path = Path(cfg.data.species)
    logger.info("Loading species from %s", path)
    df = pd.read_csv(path)
    # Map watering category to numeric priority
    watering_map = {"Minimum": 1, "Average": 2, "Frequent": 3}
    df["watering_category_num"] = df["watering"].map(watering_map).fillna(2)
    logger.info("Species loaded: %d rows", len(df))
    return df


def load_all(cfg: Config = DEFAULT_CONFIG) -> dict[str, pd.DataFrame]:
    """Convenience: load all DataFrames at once."""
    return {
        "readings": load_readings(cfg),
        "watering_events": load_watering_events(cfg),
        "plant_instances": load_plant_instances(cfg),
        "species": load_species(cfg),
    }

