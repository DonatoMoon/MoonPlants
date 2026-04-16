"""
Central configuration for the MoonPlants ML system.
All constants, paths, and hyperparameters live here – no magic numbers in code.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List

# ── Project root ──────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parents[2]  # moonplants_ml/
DATA_DIR = ROOT_DIR / "data"
ARTIFACTS_DIR = ROOT_DIR / "artifacts"
MODELS_DIR = ARTIFACTS_DIR / "models"
METRICS_DIR = ARTIFACTS_DIR / "metrics"
PLOTS_DIR = ARTIFACTS_DIR / "plots"


# ── Raw file names ─────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class DataFiles:
    readings: Path = DATA_DIR / "readings_10min.csv"
    watering_events: Path = DATA_DIR / "watering_events.csv"
    plant_instances: Path = DATA_DIR / "plant_instances.csv"
    species: Path = DATA_DIR / "species.csv"
    features_cache: Path = ARTIFACTS_DIR / "features_cache.parquet"


# ── Sensor value constraints ───────────────────────────────────────────────────
@dataclass(frozen=True)
class SensorConstraints:
    soil_moisture_min: float = 0.0
    soil_moisture_max: float = 1.0
    air_humidity_min: float = 0.0
    air_humidity_max: float = 100.0
    light_lux_min: float = 0.0
    soil_temp_min: float = 0.0
    soil_temp_max: float = 50.0
    air_temp_min: float = 0.0
    air_temp_max: float = 50.0


# ── Feature engineering ────────────────────────────────────────────────────────
@dataclass(frozen=True)
class FeatureConfig:
    # Rolling window sizes in minutes (10-min intervals → n_steps = minutes/10)
    rolling_windows_minutes: List[int] = field(default_factory=lambda: [60, 360, 1440])
    lag_steps: List[int] = field(default_factory=lambda: [1, 3, 6, 12, 18, 36, 72, 144])
    # Daylight hours (local approximation, UTC+0)
    daylight_start_hour: int = 6
    daylight_end_hour: int = 20
    # VPD saturation constant (Magnus formula approximation)
    vpd_magnus_a: float = 17.27
    vpd_magnus_b: float = 237.3


# ── Train / val / test split ───────────────────────────────────────────────────
@dataclass(frozen=True)
class SplitConfig:
    # Fraction of time-sorted data; test is always last
    train_frac: float = 0.70
    val_frac: float = 0.15
    # test_frac = 1 - train_frac - val_frac = 0.15


# ── Moisture trajectory model (approach A) ─────────────────────────────────────
@dataclass(frozen=True)
class TrajectoryModelConfig:
    # Forecast horizon in steps (10-min each)
    horizon_steps: int = 432          # 72 h = 3 days
    # Features are built at each step; target = moisture t+horizon
    target_col: str = "soil_moisture"
    # LightGBM hyperparameters
    n_estimators: int = 500
    learning_rate: float = 0.05
    num_leaves: int = 63
    min_child_samples: int = 20
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    random_state: int = 42
    early_stopping_rounds: int = 50
    # Moisture threshold fraction relative to species prior
    # e.g. "water when moisture drops to low_threshold"
    default_low_threshold: float = 0.25  # absolute (0..1)
    default_high_target: float = 0.65    # absolute (0..1)


# ── Direct time-to-event model (approach B) ────────────────────────────────────
@dataclass(frozen=True)
class TimeToEventModelConfig:
    # Target: hours until next watering event
    target_col: str = "hours_to_next_watering"
    n_estimators: int = 500
    learning_rate: float = 0.05
    num_leaves: int = 63
    min_child_samples: int = 20
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    random_state: int = 42
    early_stopping_rounds: int = 50
    # Maximum sensible time-to-event (cap outliers)
    max_hours: float = 240.0   # 10 days — physical upper bound given benchmark data


# ── Amount model ──────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class AmountModelConfig:
    # Target: amount_ml that was given
    target_col: str = "amount_ml"
    n_estimators: int = 300
    learning_rate: float = 0.05
    num_leaves: int = 31
    min_child_samples: int = 10
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    random_state: int = 42
    early_stopping_rounds: int = 30
    # Physical minimum watering (below this we don't recommend watering)
    min_amount_ml: float = 10.0


# ── Per-plant calibration ─────────────────────────────────────────────────────
@dataclass(frozen=True)
class CalibrationConfig:
    # Minimum number of watering events before activating per-plant bias
    min_events_for_calibration: int = 2
    # EMA smoothing factor for per-plant bias update
    ema_alpha: float = 0.4


# ── Evaluation ────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class EvalConfig:
    # ±hours window for "hit rate" calculation
    hit_window_hours: float = 12.0
    # Number of plant instances to plot in diagnostic charts
    n_plants_to_plot: int = 3


# ── Master config ─────────────────────────────────────────────────────────────
@dataclass
class Config:
    data: DataFiles = field(default_factory=DataFiles)
    sensors: SensorConstraints = field(default_factory=SensorConstraints)
    features: FeatureConfig = field(default_factory=FeatureConfig)
    split: SplitConfig = field(default_factory=SplitConfig)
    trajectory_model: TrajectoryModelConfig = field(default_factory=TrajectoryModelConfig)
    tte_model: TimeToEventModelConfig = field(default_factory=TimeToEventModelConfig)
    amount_model: AmountModelConfig = field(default_factory=AmountModelConfig)
    calibration: CalibrationConfig = field(default_factory=CalibrationConfig)
    eval: EvalConfig = field(default_factory=EvalConfig)


# Singleton default config used across modules
DEFAULT_CONFIG = Config()

