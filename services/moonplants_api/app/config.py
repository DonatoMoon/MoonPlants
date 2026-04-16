from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class FeatureConfig:
    rolling_windows_minutes: List[int] = field(default_factory=lambda: [60, 360, 1440])
    lag_steps: List[int] = field(default_factory=lambda: [1, 3, 6, 12, 18, 36, 72, 144])
    daylight_start_hour: int = 6
    daylight_end_hour: int = 20
    vpd_magnus_a: float = 17.27
    vpd_magnus_b: float = 237.3


@dataclass(frozen=True)
class TrajectoryModelConfig:
    horizon_steps: int = 432          # 72h
    default_low_threshold: float = 0.25
    default_high_target: float = 0.65


@dataclass(frozen=True)
class TimeToEventModelConfig:
    max_hours: float = 240.0


@dataclass(frozen=True)
class AmountModelConfig:
    min_amount_ml: float = 10.0


# Default values for missing Supabase columns:
@dataclass(frozen=True)
class PlantDefaults:
    soil_retention_factor: float = 0.5
    drainage_factor: float = 0.3
    sensor_dry_raw: int = 1500
    sensor_wet_raw: int = 500
    baseline_air_temp_c: float = 22.0
    baseline_air_humidity_pct: float = 50.0
    watering_benchmark_days_min: float = 5.0
    watering_benchmark_days_max: float = 10.0
    drought_tolerant: bool = False


@dataclass
class Config:
    features: FeatureConfig = field(default_factory=FeatureConfig)
    trajectory_model: TrajectoryModelConfig = field(default_factory=TrajectoryModelConfig)
    tte_model: TimeToEventModelConfig = field(default_factory=TimeToEventModelConfig)
    amount_model: AmountModelConfig = field(default_factory=AmountModelConfig)
    plant_defaults: PlantDefaults = field(default_factory=PlantDefaults)


DEFAULT_CONFIG = Config()
