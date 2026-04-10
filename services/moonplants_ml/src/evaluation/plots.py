"""
Diagnostic plots for MoonPlants ML.
Uses only matplotlib (no seaborn).
All functions save figures to disk and return the figure object.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")  # non-interactive backend, safe for scripts
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


def _save(fig: plt.Figure, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    logger.info("Plot saved: %s", path)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Moisture trajectory per plant
# ─────────────────────────────────────────────────────────────────────────────

def plot_moisture_trajectory(
    df: pd.DataFrame,
    plant_instance_id: int,
    pred_col: str = "pred_moisture_at_horizon",
    watering_events: Optional[pd.DataFrame] = None,
    low_threshold: float = 0.25,
    cfg: Config = DEFAULT_CONFIG,
    save_dir: Optional[Path] = None,
) -> plt.Figure:
    """
    Plot actual soil_moisture + predicted moisture-at-horizon + watering events
    for one plant_instance_id.
    """
    pdata = df[df["plant_instance_id"] == plant_instance_id].copy()
    pdata = pdata.sort_values("timestamp_utc")

    fig, ax = plt.subplots(figsize=(14, 5))

    # Actual moisture
    ax.plot(
        pdata["timestamp_utc"], pdata["soil_moisture"],
        color="#2196F3", linewidth=1.2, label="Actual moisture", zorder=3,
    )

    # Predicted moisture at horizon (shifted to align with current time)
    if pred_col in pdata.columns:
        ax.plot(
            pdata["timestamp_utc"], pdata[pred_col],
            color="#FF9800", linewidth=1.0, linestyle="--",
            label=f"Predicted moisture @ +{cfg.trajectory_model.horizon_steps//6}h",
            alpha=0.8, zorder=2,
        )

    # Low threshold line
    ax.axhline(
        low_threshold, color="#F44336", linewidth=1.0,
        linestyle=":", label=f"Low threshold ({low_threshold:.2f})", zorder=1,
    )

    # Watering events
    if watering_events is not None:
        pev = watering_events[watering_events["plant_instance_id"] == plant_instance_id]
        for _, ev in pev.iterrows():
            ax.axvline(ev["timestamp_utc"], color="#4CAF50", linewidth=1.5,
                       alpha=0.6, zorder=4)
        # Legend proxy
        if not pev.empty:
            ax.axvline(
                pev.iloc[0]["timestamp_utc"], color="#4CAF50",
                linewidth=1.5, alpha=0.6, label="Watering event (actual)",
            )

    ax.set_xlabel("Date")
    ax.set_ylabel("Soil Moisture (0–1)")
    ax.set_title(f"Plant #{plant_instance_id} — Moisture Trajectory")
    ax.legend(loc="upper right", fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    ax.xaxis.set_major_locator(mdates.DayLocator(interval=3))
    fig.autofmt_xdate()
    ax.set_ylim(-0.05, 1.05)
    ax.grid(True, alpha=0.3)

    if save_dir:
        _save(fig, save_dir / f"trajectory_plant_{plant_instance_id}.png")
    return fig


# ─────────────────────────────────────────────────────────────────────────────
# 2. Predicted vs actual time-to-event scatter
# ─────────────────────────────────────────────────────────────────────────────

def plot_tte_scatter(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    title: str = "Time-to-Event: Predicted vs Actual",
    save_dir: Optional[Path] = None,
    filename: str = "tte_scatter.png",
) -> plt.Figure:
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    yt, yp = y_true[mask], y_pred[mask]

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.scatter(yt, yp, alpha=0.3, s=10, color="#2196F3")
    lim = max(yt.max(), yp.max()) * 1.05
    ax.plot([0, lim], [0, lim], "r--", linewidth=1, label="Perfect prediction")
    ax.set_xlabel("Actual hours to next watering")
    ax.set_ylabel("Predicted hours to next watering")
    ax.set_title(title)
    ax.legend()
    ax.grid(True, alpha=0.3)
    mae = np.mean(np.abs(yt - yp))
    ax.set_title(f"{title}\nMAE = {mae:.2f} h")

    if save_dir:
        _save(fig, save_dir / filename)
    return fig


# ─────────────────────────────────────────────────────────────────────────────
# 3. Amount predicted vs actual
# ─────────────────────────────────────────────────────────────────────────────

def plot_amount_scatter(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    title: str = "Amount: Predicted vs Actual",
    save_dir: Optional[Path] = None,
    filename: str = "amount_scatter.png",
) -> plt.Figure:
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    yt, yp = y_true[mask], y_pred[mask]

    fig, ax = plt.subplots(figsize=(6, 6))
    ax.scatter(yt, yp, alpha=0.5, s=30, color="#4CAF50")
    lim = max(yt.max(), yp.max()) * 1.05
    ax.plot([0, lim], [0, lim], "r--", linewidth=1, label="Perfect prediction")
    ax.set_xlabel("Actual amount_ml")
    ax.set_ylabel("Predicted amount_ml")
    mae = np.mean(np.abs(yt - yp))
    ax.set_title(f"{title}\nMAE = {mae:.1f} ml")
    ax.legend()
    ax.grid(True, alpha=0.3)

    if save_dir:
        _save(fig, save_dir / filename)
    return fig


# ─────────────────────────────────────────────────────────────────────────────
# 4. Error over time (residuals)
# ─────────────────────────────────────────────────────────────────────────────

def plot_residuals_over_time(
    timestamps: pd.Series,
    residuals: np.ndarray,
    title: str = "Residuals over time",
    ylabel: str = "Residual",
    save_dir: Optional[Path] = None,
    filename: str = "residuals_time.png",
) -> plt.Figure:
    fig, ax = plt.subplots(figsize=(14, 4))
    ax.scatter(timestamps, residuals, s=5, alpha=0.3, color="#9C27B0")
    ax.axhline(0, color="red", linewidth=1, linestyle="--")
    ax.set_xlabel("Date")
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
    fig.autofmt_xdate()
    ax.grid(True, alpha=0.3)

    if save_dir:
        _save(fig, save_dir / filename)
    return fig


# ─────────────────────────────────────────────────────────────────────────────
# 5. Calibration comparison (before/after per-plant bias)
# ─────────────────────────────────────────────────────────────────────────────

def plot_calibration_comparison(
    plant_ids: List[int],
    mae_before: List[float],
    mae_after: List[float],
    metric_name: str = "MAE (hours)",
    save_dir: Optional[Path] = None,
    filename: str = "calibration_comparison.png",
) -> plt.Figure:
    x = np.arange(len(plant_ids))
    width = 0.35

    fig, ax = plt.subplots(figsize=(max(8, len(plant_ids) * 1.5), 5))
    bars1 = ax.bar(x - width / 2, mae_before, width, label="Before calibration", color="#FF9800")
    bars2 = ax.bar(x + width / 2, mae_after,  width, label="After calibration",  color="#4CAF50")

    ax.set_xlabel("Plant Instance ID")
    ax.set_ylabel(metric_name)
    ax.set_title(f"Per-plant Calibration Effect — {metric_name}")
    ax.set_xticks(x)
    ax.set_xticklabels([f"Plant #{p}" for p in plant_ids])
    ax.legend()
    ax.grid(True, alpha=0.3, axis="y")

    if save_dir:
        _save(fig, save_dir / filename)
    return fig

