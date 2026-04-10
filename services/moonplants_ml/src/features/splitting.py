"""
Time-based train/val/test split with zero leakage.
Split is performed globally by timestamp (not per-plant),
so the holdout set always represents a later time window.
"""
from __future__ import annotations

import logging
from typing import Tuple

import pandas as pd

from config.settings import Config, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


def time_split(
    df: pd.DataFrame,
    cfg: Config = DEFAULT_CONFIG,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Split df into train / val / test based on global timestamp ordering.

    Parameters
    ----------
    df : pd.DataFrame  (must contain 'timestamp_utc')
    cfg : Config

    Returns
    -------
    train, val, test : DataFrames sorted by timestamp_utc
    """
    df_sorted = df.sort_values("timestamp_utc").reset_index(drop=True)
    n = len(df_sorted)
    n_train = int(n * cfg.split.train_frac)
    n_val = int(n * cfg.split.val_frac)

    train = df_sorted.iloc[:n_train].copy()
    val   = df_sorted.iloc[n_train : n_train + n_val].copy()
    test  = df_sorted.iloc[n_train + n_val :].copy()

    # Sanity: no timestamp overlap
    assert train["timestamp_utc"].max() <= val["timestamp_utc"].min(), \
        "Leakage: train timestamps overlap with val"
    assert val["timestamp_utc"].max() <= test["timestamp_utc"].min(), \
        "Leakage: val timestamps overlap with test"

    logger.info(
        "Time split → train: %d, val: %d, test: %d rows",
        len(train), len(val), len(test),
    )
    logger.info(
        "  train period: %s → %s",
        train["timestamp_utc"].min(), train["timestamp_utc"].max(),
    )
    logger.info(
        "  val   period: %s → %s",
        val["timestamp_utc"].min(), val["timestamp_utc"].max(),
    )
    logger.info(
        "  test  period: %s → %s",
        test["timestamp_utc"].min(), test["timestamp_utc"].max(),
    )

    return train, val, test

