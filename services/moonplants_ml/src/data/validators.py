"""
Data validation for MoonPlants ML.
Raises or logs issues; returns a ValidationReport.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List

import pandas as pd

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


@dataclass
class ValidationReport:
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def summary(self) -> str:
        lines = []
        if self.errors:
            lines.append(f"ERRORS ({len(self.errors)}):")
            lines.extend(f"  ✗ {e}" for e in self.errors)
        if self.warnings:
            lines.append(f"WARNINGS ({len(self.warnings)}):")
            lines.extend(f"  ⚠ {w}" for w in self.warnings)
        if not lines:
            lines.append("✓ All validation checks passed.")
        return "\n".join(lines)


def validate_readings(
    df: pd.DataFrame, cfg: Config = DEFAULT_CONFIG
) -> ValidationReport:
    """Validate 10-min sensor readings DataFrame."""
    report = ValidationReport()
    s = cfg.sensors

    # ── Schema checks ─────────────────────────────────────────────────────────
    # NOTE: is_watering_event and watering_amount_ml are NOT in readings —
    #       watering data lives exclusively in watering_events.csv
    required_cols = {
        "timestamp_utc", "plant_instance_id", "species_id",
        "soil_moisture", "soil_temperature_c", "air_temperature_c",
        "air_humidity_pct", "light_lux",
    }
    missing = required_cols - set(df.columns)
    if missing:
        report.errors.append(f"Missing columns: {missing}")

    if df.empty:
        report.errors.append("Readings DataFrame is empty.")
        return report

    # ── Duplicates ────────────────────────────────────────────────────────────
    dup_count = df.duplicated(subset=["plant_instance_id", "timestamp_utc"]).sum()
    if dup_count > 0:
        report.errors.append(
            f"Duplicate (plant_instance_id, timestamp_utc): {dup_count} rows"
        )

    # ── Monotonicity per plant ─────────────────────────────────────────────────
    non_monotone_plants = []
    for pid, grp in df.groupby("plant_instance_id"):
        if not grp["timestamp_utc"].is_monotonic_increasing:
            non_monotone_plants.append(pid)
    if non_monotone_plants:
        report.errors.append(
            f"Non-monotone timestamps for plant_instance_ids: {non_monotone_plants}"
        )

    # ── Value range checks ─────────────────────────────────────────────────────
    def check_range(col: str, lo: float, hi: float) -> None:
        if col not in df.columns:
            return
        out = df[(df[col] < lo) | (df[col] > hi)]
        if not out.empty:
            report.warnings.append(
                f"Column '{col}' has {len(out)} values outside [{lo}, {hi}]"
            )

    check_range("soil_moisture", s.soil_moisture_min, s.soil_moisture_max)
    check_range("air_humidity_pct", s.air_humidity_min, s.air_humidity_max)
    check_range("light_lux", s.light_lux_min, 1e6)
    check_range("soil_temperature_c", s.soil_temp_min, s.soil_temp_max)
    check_range("air_temperature_c", s.air_temp_min, s.air_temp_max)

    # ── Missing values ─────────────────────────────────────────────────────────
    sensor_cols = [
        "soil_moisture", "soil_temperature_c", "air_temperature_c",
        "air_humidity_pct", "light_lux",
    ]
    for col in sensor_cols:
        if col in df.columns:
            n_null = df[col].isna().sum()
            if n_null > 0:
                report.warnings.append(f"Column '{col}' has {n_null} NaN values")


    return report


def validate_watering_events(
    df: pd.DataFrame, cfg: Config = DEFAULT_CONFIG
) -> ValidationReport:
    """Validate watering events DataFrame."""
    report = ValidationReport()

    required_cols = {
        "timestamp_utc", "plant_instance_id", "amount_ml",
        "moisture_before", "moisture_after",
    }
    missing = required_cols - set(df.columns)
    if missing:
        report.errors.append(f"Missing columns in watering_events: {missing}")
        return report

    # Amount sanity
    neg_amt = (df["amount_ml"] <= 0).sum()
    if neg_amt > 0:
        report.errors.append(f"Non-positive amount_ml in watering_events: {neg_amt} rows")

    # Moisture before < moisture after (water should raise moisture)
    inverted = (df["moisture_before"] > df["moisture_after"]).sum()
    if inverted > 0:
        report.warnings.append(
            f"moisture_before > moisture_after in {inverted} watering events"
        )

    # moisture in [0,1]
    for col in ["moisture_before", "moisture_after", "target_moisture"]:
        if col in df.columns:
            out = df[(df[col] < 0) | (df[col] > 1)]
            if not out.empty:
                report.warnings.append(
                    f"Column '{col}' has {len(out)} values outside [0,1]"
                )

    return report

