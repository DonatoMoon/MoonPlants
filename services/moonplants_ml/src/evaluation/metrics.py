"""
Evaluation metrics for MoonPlants ML.
All metric functions are pure (no side effects) and work on numpy arrays.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Dict, Optional


# ─────────────────────────────────────────────────────────────────────────────
# Time-to-event metrics
# ─────────────────────────────────────────────────────────────────────────────

def mae_hours(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Error in hours."""
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    if mask.sum() == 0:
        return float("nan")
    return float(np.mean(np.abs(y_true[mask] - y_pred[mask])))


def mape_hours(
    y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1.0
) -> float:
    """Mean Absolute Percentage Error (%), clamping denominator to eps to avoid div/0."""
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    if mask.sum() == 0:
        return float("nan")
    denom = np.maximum(np.abs(y_true[mask]), eps)
    return float(100.0 * np.mean(np.abs(y_true[mask] - y_pred[mask]) / denom))


def hit_rate(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    window_hours: float = 12.0,
) -> float:
    """Fraction of predictions within ±window_hours of ground truth."""
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    if mask.sum() == 0:
        return float("nan")
    hits = np.abs(y_true[mask] - y_pred[mask]) <= window_hours
    return float(hits.mean())


def tte_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    window_hours: float = 12.0,
) -> Dict[str, float]:
    return {
        "mae_hours": mae_hours(y_true, y_pred),
        "mape_pct": mape_hours(y_true, y_pred),
        f"hit_rate_±{int(window_hours)}h": hit_rate(y_true, y_pred, window_hours),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Amount metrics
# ─────────────────────────────────────────────────────────────────────────────

def amount_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    moisture_before: Optional[np.ndarray] = None,
    moisture_after: Optional[np.ndarray] = None,
    moisture_pred_after: Optional[np.ndarray] = None,
    target_moisture: Optional[np.ndarray] = None,
) -> Dict[str, float]:
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    metrics: Dict[str, float] = {}
    if mask.sum() > 0:
        metrics["mae_ml"] = float(np.mean(np.abs(y_true[mask] - y_pred[mask])))
        metrics["rmse_ml"] = float(
            np.sqrt(np.mean((y_true[mask] - y_pred[mask]) ** 2))
        )
        metrics["mape_pct"] = float(
            100.0 * np.mean(
                np.abs(y_true[mask] - y_pred[mask]) / np.maximum(y_true[mask], 1.0)
            )
        )

    # Optional: moisture target accuracy
    if (
        moisture_pred_after is not None
        and target_moisture is not None
    ):
        m = ~np.isnan(moisture_pred_after) & ~np.isnan(target_moisture)
        if m.sum() > 0:
            metrics["mae_moisture_after"] = float(
                np.mean(np.abs(moisture_pred_after[m] - target_moisture[m]))
            )

    return metrics


# ─────────────────────────────────────────────────────────────────────────────
# Moisture trajectory metrics
# ─────────────────────────────────────────────────────────────────────────────

def trajectory_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> Dict[str, float]:
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    if mask.sum() == 0:
        return {"mae": float("nan"), "rmse": float("nan")}
    err = y_true[mask] - y_pred[mask]
    return {
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err ** 2))),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Summary reporter
# ─────────────────────────────────────────────────────────────────────────────

def format_metrics(metrics: Dict[str, float], title: str = "") -> str:
    lines = []
    if title:
        lines.append(f"── {title} ──")
    for k, v in metrics.items():
        if isinstance(v, float):
            lines.append(f"  {k:35s}: {v:.4f}")
        else:
            lines.append(f"  {k:35s}: {v}")
    return "\n".join(lines)

