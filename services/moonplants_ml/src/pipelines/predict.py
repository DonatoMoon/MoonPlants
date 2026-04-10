"""
Inference pipeline — predict_watering_plan for a given plant.

Usage:
    python -m pipelines.predict --plant_instance_id 1
    python -m pipelines.predict --plant_instance_id 3 --now "2026-01-25T12:00:00+00:00"
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

_SRC = Path(__file__).resolve().parent.parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from config import DEFAULT_CONFIG, MODELS_DIR
from data import load_all, load_plant_instances, load_species
from features import (
    build_features, merge_metadata,
    add_calendar_features, add_env_features, add_moisture_lag_rolling,
)
from models import TrajectoryModel, TimeToEventModel, AmountModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("predict")


# ─────────────────────────────────────────────────────────────────────────────

def load_models(cfg=DEFAULT_CONFIG) -> tuple[TrajectoryModel, TimeToEventModel, AmountModel]:
    traj   = TrajectoryModel.load(MODELS_DIR / "trajectory_model.pkl")
    tte    = TimeToEventModel.load(MODELS_DIR / "tte_model.pkl")
    amount = AmountModel.load(MODELS_DIR / "amount_model.pkl")
    return traj, tte, amount


def get_plant_threshold(
    plant_instance_id: int,
    plant_instances: pd.DataFrame,
    species: pd.DataFrame,
    cfg=DEFAULT_CONFIG,
) -> tuple[float, float]:
    """
    Return (low_threshold, high_target) for a given plant.
    Uses species watering benchmark as prior; refined by per-plant data if available.
    """
    # Default from config
    low  = cfg.trajectory_model.default_low_threshold
    high = cfg.trajectory_model.default_high_target

    row = plant_instances[plant_instances["plant_instance_id"] == plant_instance_id]
    if row.empty:
        return low, high

    sid = int(row.iloc[0]["species_id"])
    spec = species[species["species_id"] == sid]
    if spec.empty:
        return low, high

    watering_cat = spec.iloc[0].get("watering", "Average")
    # Adjust thresholds based on watering category
    if watering_cat == "Minimum":
        low, high = 0.20, 0.55
    elif watering_cat == "Frequent":
        low, high = 0.35, 0.70
    else:  # Average
        low, high = 0.25, 0.65

    return low, high


def predict_watering_plan(
    plant_instance_id: int,
    now_ts: Optional[datetime] = None,
    cfg=DEFAULT_CONFIG,
) -> dict:
    """
    Main inference function.

    Parameters
    ----------
    plant_instance_id : int
    now_ts : datetime (UTC) — defaults to current UTC time

    Returns
    -------
    dict with keys:
        plant_instance_id, timestamp, time_to_water_hours,
        recommended_ml, confidence, rationale,
        trajectory_pred_moisture, tte_pred_hours,
        low_threshold, high_target
    """
    if now_ts is None:
        now_ts = datetime.now(timezone.utc)

    logger.info("Predicting watering plan for plant %d at %s", plant_instance_id, now_ts)

    # ── Load data & models ─────────────────────────────────────────────────
    tables = load_all(cfg)
    traj_model, tte_model, amt_model = load_models(cfg)

    # ── Get plant-specific thresholds ───────────────────────────────────────
    low_thr, high_tgt = get_plant_threshold(
        plant_instance_id,
        tables["plant_instances"],
        tables["species"],
        cfg,
    )

    # ── Build features for the plant up to now_ts ──────────────────────────
    readings = tables["readings"]
    plant_readings = readings[
        (readings["plant_instance_id"] == plant_instance_id) &
        (readings["timestamp_utc"] <= pd.Timestamp(now_ts))
    ].copy()

    if plant_readings.empty:
        raise ValueError(
            f"No readings found for plant_instance_id={plant_instance_id} "
            f"at or before {now_ts}"
        )

    # Recompute features on the plant's readings slice (no future leakage)
    feat = build_features(
        readings=plant_readings,
        watering_events=tables["watering_events"],
        plant_instances=tables["plant_instances"],
        species=tables["species"],
        cfg=cfg,
        add_targets=False,  # inference mode — no future targets
    )

    # Use the most recent reading as the snapshot
    snapshot = feat.sort_values("timestamp_utc").iloc[-1]
    current_moisture = float(snapshot["soil_moisture"])

    # ── Trajectory prediction ───────────────────────────────────────────────
    traj_hours, pred_moisture_h = traj_model.find_time_to_threshold(
        snapshot, low_threshold=low_thr
    )

    # ── TTE direct prediction ───────────────────────────────────────────────
    X_snap = pd.DataFrame([snapshot])
    tte_hours = float(
        tte_model.predict_with_bias(X_snap, plant_instance_id)[0]
    )

    # ── Ensemble: weighted average (trajectory is primary) ─────────────────
    if traj_hours is not None:
        # Both models agree direction; average with trajectory as primary (0.7/0.3)
        ensemble_hours = 0.7 * traj_hours + 0.3 * tte_hours
        confidence = "high" if abs(traj_hours - tte_hours) < 12 else "medium"
    else:
        # Trajectory says "won't reach threshold in horizon" — rely on TTE
        ensemble_hours = tte_hours
        confidence = "low"

    ensemble_hours = max(0.0, ensemble_hours)

    # ── Amount recommendation ───────────────────────────────────────────────
    target_moisture = (low_thr + high_tgt) / 2.0  # midpoint of healthy band
    recommended_ml = amt_model.recommend_amount(
        snapshot, target_moisture, plant_instance_id
    )

    # ── Rationale ──────────────────────────────────────────────────────────
    rationale_parts = [
        f"Current moisture: {current_moisture:.3f}",
        f"Low threshold (species prior): {low_thr:.2f}",
        f"Trajectory model predicts moisture@+{cfg.trajectory_model.horizon_steps//6}h = "
        f"{pred_moisture_h:.3f}" + (
            f"; crosses threshold in ~{traj_hours:.1f}h" if traj_hours is not None
            else "; stays above threshold in forecast horizon"
        ),
        f"TTE model predicts {tte_hours:.1f}h until watering needed",
        f"Ensemble time-to-water: {ensemble_hours:.1f}h (confidence: {confidence})",
        f"Recommended amount to reach target moisture {target_moisture:.2f}: {recommended_ml:.0f} ml",
    ]

    result = {
        "plant_instance_id": plant_instance_id,
        "timestamp": now_ts.isoformat(),
        "current_moisture": round(current_moisture, 4),
        "time_to_water_hours": round(ensemble_hours, 2),
        "recommended_ml": round(recommended_ml, 1),
        "confidence": confidence,
        "rationale": " | ".join(rationale_parts),
        "trajectory_pred_moisture_at_horizon": round(float(pred_moisture_h), 4),
        "trajectory_hours": round(float(traj_hours), 2) if traj_hours is not None else None,
        "tte_pred_hours": round(float(tte_hours), 2),
        "low_threshold": low_thr,
        "high_target": high_tgt,
    }

    logger.info("Watering plan: %s", json.dumps(result, indent=2, default=str))
    return result


# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Predict watering plan for a plant")
    p.add_argument("--plant_instance_id", type=int, required=True)
    p.add_argument(
        "--now", type=str, default=None,
        help="ISO8601 timestamp (UTC) for inference, e.g. 2026-01-25T12:00:00+00:00",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    now_ts = None
    if args.now:
        now_ts = datetime.fromisoformat(args.now)
        if now_ts.tzinfo is None:
            now_ts = now_ts.replace(tzinfo=timezone.utc)

    result = predict_watering_plan(args.plant_instance_id, now_ts)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()

