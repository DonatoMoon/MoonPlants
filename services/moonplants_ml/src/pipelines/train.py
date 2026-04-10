"""
Training pipeline for MoonPlants ML.

Usage:
    python -m pipelines.train
    python -m pipelines.train --rebuild-features
    python -m pipelines.train --no-plots

Steps executed:
  1. Load & validate data
  2. Build / load cached features
  3. Time-based split
  4. Baseline evaluation
  5. Train TrajectoryModel (Approach A)
  6. Train TimeToEventModel (Approach B)
  7. Train AmountModel
  8. Per-plant calibration
  9. Save artefacts & metrics
  10. Generate diagnostic plots
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

# ── Ensure src/ is on PYTHONPATH when run as __main__ ────────────────────────
_SRC = Path(__file__).resolve().parent.parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from config import DEFAULT_CONFIG, MODELS_DIR, METRICS_DIR, PLOTS_DIR
from data import (
    load_all, validate_readings, validate_watering_events,
)
from features import build_features, save_features, load_features_cache, time_split
from models import (
    TimeBaseline, AmountBaseline,
    TrajectoryModel, TimeToEventModel,
    AmountModel, build_amount_dataset,
)
from evaluation import (
    tte_metrics, trajectory_metrics, amount_metrics, format_metrics,
    plot_moisture_trajectory, plot_tte_scatter, plot_amount_scatter,
    plot_calibration_comparison,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train")


# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train MoonPlants ML models")
    p.add_argument(
        "--rebuild-features", action="store_true",
        help="Ignore feature cache and recompute from scratch",
    )
    p.add_argument(
        "--no-plots", action="store_true",
        help="Skip generating diagnostic plots",
    )
    p.add_argument(
        "--config", type=str, default=None,
        help="(reserved) path to custom config JSON (not yet implemented)",
    )
    return p.parse_args()


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Load & validate
# ─────────────────────────────────────────────────────────────────────────────

def step1_load_validate(cfg) -> dict:
    logger.info("═══ STEP 1: Data ingest + validation ═══")
    t0 = time.time()
    tables = load_all(cfg)

    # Validate readings
    r_report = validate_readings(tables["readings"], cfg)
    logger.info("Readings validation:\n%s", r_report.summary())
    if not r_report.is_valid:
        raise RuntimeError("Readings failed validation — aborting.")

    # Validate watering events
    w_report = validate_watering_events(tables["watering_events"], cfg)
    logger.info("Watering events validation:\n%s", w_report.summary())

    # Print basic stats
    readings = tables["readings"]
    events   = tables["watering_events"]
    plants   = tables["plant_instances"]
    logger.info(
        "✓ Readings: %d rows | %d plants | %d watering events",
        len(readings), readings["plant_instance_id"].nunique(), len(events),
    )
    logger.info("  Date range: %s → %s",
                readings["timestamp_utc"].min(), readings["timestamp_utc"].max())
    logger.info("  Sample readings:\n%s",
                readings.head(3)[["timestamp_utc","plant_instance_id","soil_moisture",
                                  "air_temperature_c","light_lux"]].to_string())
    logger.info("  Step 1 done in %.1fs", time.time() - t0)
    return tables


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Feature engineering
# ─────────────────────────────────────────────────────────────────────────────

def step2_features(tables: dict, rebuild: bool, cfg) -> pd.DataFrame:
    logger.info("═══ STEP 2: Feature engineering ═══")
    t0 = time.time()

    if not rebuild:
        cached = load_features_cache(cfg)
        if cached is not None:
            logger.info("Loaded features from cache: %d rows, %d cols",
                        len(cached), cached.shape[1])
            # Quick NaN check on key lag columns
            lag_cols = [c for c in cached.columns if "lag_" in c or "roll_" in c]
            if lag_cols:
                nan_frac = cached[lag_cols].isna().mean().max()
                logger.info("Max NaN fraction in lag/rolling cols: %.3f", nan_frac)
            return cached

    features = build_features(
        readings=tables["readings"],
        watering_events=tables["watering_events"],
        plant_instances=tables["plant_instances"],
        species=tables["species"],
        cfg=cfg,
        add_targets=True,
    )

    # Sanity assertions
    assert len(features) == len(tables["readings"]), \
        f"Feature rows mismatch: {len(features)} vs {len(tables['readings'])}"
    assert "moisture_at_horizon" in features.columns, "Missing trajectory target"
    assert "hours_to_next_watering" in features.columns, "Missing TTE target"

    # NaN check on base sensor columns (should be 0 after engineering)
    sensor_cols = ["soil_moisture","air_temperature_c","air_humidity_pct","light_lux"]
    for col in sensor_cols:
        n_nan = features[col].isna().sum()
        assert n_nan == 0, f"Unexpected NaN in {col}: {n_nan}"

    save_features(features, cfg)
    logger.info("Features built & cached: %d rows, %d cols | Step 2 done in %.1fs",
                len(features), features.shape[1], time.time() - t0)
    return features


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Baselines
# ─────────────────────────────────────────────────────────────────────────────

def step3_baselines(features: pd.DataFrame, tables: dict, cfg) -> dict:
    logger.info("═══ STEP 3: Baselines ═══")
    t0 = time.time()
    events = tables["watering_events"]

    time_bl = TimeBaseline().fit(events)
    amt_bl  = AmountBaseline().fit(events)

    train, val, test = time_split(features, cfg)

    # TTE baseline on test
    test_tte = test.dropna(subset=["hours_to_next_watering"]).copy()
    if not test_tte.empty:
        y_true_tte = test_tte["hours_to_next_watering"].values
        y_pred_bl_tte = time_bl.predict_batch(test_tte)
        bl_tte = tte_metrics(y_true_tte, y_pred_bl_tte, cfg.eval.hit_window_hours)
        logger.info("Baseline TTE metrics (test):\n%s",
                    format_metrics(bl_tte, "TimeBaseline"))
    else:
        bl_tte = {}

    # Amount baseline on events
    y_true_amt = events["amount_ml"].values
    y_pred_bl_amt = amt_bl.predict_batch(events)
    bl_amt = amount_metrics(y_true_amt, y_pred_bl_amt)
    logger.info("Baseline Amount metrics:\n%s",
                format_metrics(bl_amt, "AmountBaseline"))

    logger.info("Step 3 done in %.1fs", time.time() - t0)
    return {
        "time_baseline": time_bl,
        "amount_baseline": amt_bl,
        "baseline_tte_metrics": bl_tte,
        "baseline_amount_metrics": bl_amt,
        "train": train, "val": val, "test": test,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Trajectory model (Approach A)
# ─────────────────────────────────────────────────────────────────────────────

def step4_trajectory(train, val, test, tables, cfg, make_plots, all_metrics) -> TrajectoryModel:
    logger.info("═══ STEP 4: TrajectoryModel (Approach A) ═══")
    t0 = time.time()

    traj_model = TrajectoryModel(cfg).fit(train, val)
    traj_model.save(MODELS_DIR / "trajectory_model.pkl")

    # Evaluate on test
    test_c = test.dropna(subset=["moisture_at_horizon"]).copy()
    if not test_c.empty:
        preds = traj_model.predict(test_c)
        test_c["pred_moisture_at_horizon"] = preds
        m = trajectory_metrics(
            test_c["moisture_at_horizon"].values, preds
        )
        logger.info("TrajectoryModel test metrics:\n%s",
                    format_metrics(m, "Trajectory (test)"))
        all_metrics["trajectory"] = m

        if make_plots:
            PLOTS_DIR.mkdir(parents=True, exist_ok=True)
            plant_ids = test_c["plant_instance_id"].unique()[:cfg.eval.n_plants_to_plot]
            full_feat = pd.concat([train, val, test_c], ignore_index=True)
            full_feat_with_pred = full_feat.copy()
            all_preds = traj_model.predict(
                full_feat_with_pred.dropna(subset=["moisture_at_horizon"])
            )
            full_feat_with_pred.loc[
                full_feat_with_pred["moisture_at_horizon"].notna(),
                "pred_moisture_at_horizon"
            ] = all_preds
            for pid in plant_ids:
                plot_moisture_trajectory(
                    full_feat_with_pred, int(pid),
                    watering_events=tables["watering_events"],
                    low_threshold=cfg.trajectory_model.default_low_threshold,
                    cfg=cfg,
                    save_dir=PLOTS_DIR,
                )
            plot_tte_scatter(
                test_c["moisture_at_horizon"].values, preds,
                title="Trajectory: Predicted vs Actual moisture@horizon",
                save_dir=PLOTS_DIR,
                filename="trajectory_scatter.png",
            )

    logger.info("Step 4 done in %.1fs", time.time() - t0)
    return traj_model


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — TTE model (Approach B)
# ─────────────────────────────────────────────────────────────────────────────

def step5_tte(train, val, test, cfg, make_plots, all_metrics) -> TimeToEventModel:
    logger.info("═══ STEP 5: TimeToEventModel (Approach B) ═══")
    t0 = time.time()

    tte_model = TimeToEventModel(cfg).fit(train, val)
    tte_model.save(MODELS_DIR / "tte_model.pkl")

    test_c = test.dropna(subset=["hours_to_next_watering"]).copy()
    if not test_c.empty:
        preds = tte_model.predict(test_c)
        m = tte_metrics(
            test_c["hours_to_next_watering"].values, preds,
            cfg.eval.hit_window_hours,
        )
        logger.info("TimeToEventModel test metrics:\n%s",
                    format_metrics(m, "TTE (test)"))
        all_metrics["tte"] = m

        if make_plots:
            plot_tte_scatter(
                test_c["hours_to_next_watering"].values, preds,
                title="TTE Model: Predicted vs Actual hours-to-watering",
                save_dir=PLOTS_DIR,
                filename="tte_scatter.png",
            )

    logger.info("Step 5 done in %.1fs", time.time() - t0)
    return tte_model


# ─────────────────────────────────────────────────────────────────────────────
# Step 6 — Amount model
# ─────────────────────────────────────────────────────────────────────────────

def step6_amount(features, tables, cfg, make_plots, all_metrics) -> AmountModel:
    logger.info("═══ STEP 6: AmountModel ═══")
    t0 = time.time()

    train_f, val_f, test_f = time_split(features, cfg)
    events = tables["watering_events"]

    # Build amount dataset from ALL events (small dataset, no per-split needed)
    amount_df = build_amount_dataset(events, features)

    # Split by event timestamp
    event_ts = amount_df["timestamp_utc"] if "timestamp_utc" in amount_df.columns else None
    if event_ts is not None:
        cutoff_train = train_f["timestamp_utc"].max()
        cutoff_val   = val_f["timestamp_utc"].max()
        amt_train = amount_df[amount_df["timestamp_utc"] <= cutoff_train]
        amt_val   = amount_df[
            (amount_df["timestamp_utc"] > cutoff_train) &
            (amount_df["timestamp_utc"] <= cutoff_val)
        ]
        amt_test  = amount_df[amount_df["timestamp_utc"] > cutoff_val]
    else:
        from sklearn.model_selection import train_test_split as tts
        amt_train, amt_test = tts(amount_df, test_size=0.2, random_state=42)
        amt_val = amt_train.sample(frac=0.1, random_state=42)

    if len(amt_train) < 5:
        # Not enough events for a split — train on all
        logger.warning("Fewer than 5 training events; training amount model on all events")
        amt_model = AmountModel(cfg).fit(amount_df)
    else:
        amt_model = AmountModel(cfg).fit(amt_train, amt_val if len(amt_val) > 0 else None)

    amt_model.save(MODELS_DIR / "amount_model.pkl")

    if len(amt_test) > 0:
        y_true = amt_test["amount_ml"].values
        y_pred = amt_model.predict(amt_test)
        m = amount_metrics(y_true, y_pred)
        logger.info("AmountModel test metrics:\n%s",
                    format_metrics(m, "Amount (test)"))
        all_metrics["amount"] = m

        if make_plots:
            plot_amount_scatter(
                y_true, y_pred,
                save_dir=PLOTS_DIR,
                filename="amount_scatter.png",
            )

    logger.info("Step 6 done in %.1fs", time.time() - t0)
    return amt_model


# ─────────────────────────────────────────────────────────────────────────────
# Step 7 — Per-plant calibration
# ─────────────────────────────────────────────────────────────────────────────

def step7_calibration(
    features, tables, traj_model, tte_model, amt_model, cfg, make_plots, all_metrics
) -> None:
    logger.info("═══ STEP 7: Per-plant calibration ═══")
    t0 = time.time()

    train_f, val_f, test_f = time_split(features, cfg)
    # Use val set for calibration (represents "recently seen" data)
    events = tables["watering_events"]
    amount_df = build_amount_dataset(events, features)

    plant_ids = features["plant_instance_id"].unique()

    # Per-plant calibration using validation data
    cal_val = val_f.copy()

    mae_before_tte, mae_after_tte = [], []
    mae_before_traj, mae_after_traj = [], []
    calibrated_plant_ids = []

    for pid in sorted(plant_ids):
        plant_val = cal_val[cal_val["plant_instance_id"] == pid]
        plant_amt = amount_df[amount_df["plant_instance_id"] == pid] \
            if "plant_instance_id" in amount_df.columns else pd.DataFrame()

        # Calibrate TTE
        tte_model.calibrate_plant_bias(
            plant_val, int(pid), cfg.calibration.min_events_for_calibration
        )

        # Calibrate Trajectory
        traj_model.calibrate_plant_bias(
            plant_val, int(pid), cfg.calibration.min_events_for_calibration
        )

        # Calibrate Amount
        if not plant_amt.empty:
            amt_model.calibrate_plant_bias(
                plant_amt, int(pid), cfg.calibration.min_events_for_calibration
            )

        # Measure impact on test set
        plant_test = test_f[test_f["plant_instance_id"] == pid].dropna(
            subset=["hours_to_next_watering"]
        )
        if len(plant_test) < 2:
            continue

        y_true = plant_test["hours_to_next_watering"].values
        before_tte = np.mean(np.abs(y_true - tte_model.predict(plant_test)))
        after_tte  = np.mean(np.abs(y_true - tte_model.predict_with_bias(plant_test, pid)))
        mae_before_tte.append(before_tte)
        mae_after_tte.append(after_tte)

        plant_test_traj = test_f[test_f["plant_instance_id"] == pid].dropna(
            subset=["moisture_at_horizon"]
        )
        if len(plant_test_traj) >= 2:
            y_true_t = plant_test_traj["moisture_at_horizon"].values
            before_t = np.mean(np.abs(y_true_t - traj_model.predict(plant_test_traj)))
            after_t  = np.mean(np.abs(y_true_t - traj_model.predict_with_bias(plant_test_traj, pid)))
            mae_before_traj.append(before_t)
            mae_after_traj.append(after_t)

        calibrated_plant_ids.append(pid)

    if calibrated_plant_ids:
        logger.info(
            "TTE calibration — mean MAE before: %.2f h, after: %.2f h",
            np.mean(mae_before_tte), np.mean(mae_after_tte),
        )
        logger.info(
            "Trajectory calibration — mean MAE before: %.4f, after: %.4f",
            np.mean(mae_before_traj) if mae_before_traj else float('nan'),
            np.mean(mae_after_traj) if mae_after_traj else float('nan'),
        )
        all_metrics["calibration"] = {
            "tte_mae_before": float(np.mean(mae_before_tte)),
            "tte_mae_after":  float(np.mean(mae_after_tte)),
        }

        if make_plots and len(calibrated_plant_ids) >= 2:
            plot_calibration_comparison(
                calibrated_plant_ids[:8],
                mae_before_tte[:8],
                mae_after_tte[:8],
                metric_name="TTE MAE (hours)",
                save_dir=PLOTS_DIR,
                filename="calibration_tte.png",
            )

    # Re-save models with calibration baked in
    traj_model.save(MODELS_DIR / "trajectory_model.pkl")
    tte_model.save(MODELS_DIR / "tte_model.pkl")
    amt_model.save(MODELS_DIR / "amount_model.pkl")

    logger.info("Step 7 done in %.1fs", time.time() - t0)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    cfg = DEFAULT_CONFIG
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)

    make_plots = not args.no_plots
    all_metrics: dict = {}

    t_total = time.time()

    tables   = step1_load_validate(cfg)
    features = step2_features(tables, rebuild=args.rebuild_features, cfg=cfg)
    baseline = step3_baselines(features, tables, cfg)

    train, val, test = baseline["train"], baseline["val"], baseline["test"]
    all_metrics["baseline_tte"]    = baseline["baseline_tte_metrics"]
    all_metrics["baseline_amount"] = baseline["baseline_amount_metrics"]

    traj_model = step4_trajectory(train, val, test, tables, cfg, make_plots, all_metrics)
    tte_model  = step5_tte(train, val, test, cfg, make_plots, all_metrics)
    amt_model  = step6_amount(features, tables, cfg, make_plots, all_metrics)
    step7_calibration(features, tables, traj_model, tte_model, amt_model, cfg, make_plots, all_metrics)

    # Save metrics JSON
    metrics_path = METRICS_DIR / "train_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2, default=str)
    logger.info("Metrics saved to %s", metrics_path)

    logger.info(
        "═══ Training complete in %.1fs ═══", time.time() - t_total
    )
    logger.info("Artefacts in: %s", MODELS_DIR.parent)


if __name__ == "__main__":
    main()

