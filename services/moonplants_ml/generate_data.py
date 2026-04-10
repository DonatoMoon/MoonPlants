"""
Realistic Plant Sensor Data Generator — MoonPlants ML
======================================================
Generates 6 months (Feb–Jul 2026) of 10-minute sensor readings + watering events.

Physics model for soil moisture dynamics:
  dM/dt = -k_base * VPD_factor * light_factor * soil_factor * (1 + temp_deviation)
        + transpiration_noise
        + evaporation_from_surface

Where:
  k_base            — species-specific base drying rate (per 10 min step)
  VPD_factor        — vapour pressure deficit amplifies evapotranspiration
  light_factor      — photosynthesis drives stomata opening → transpiration
  soil_factor       — non-linear: dry soil dries slower (hydraulic conductivity)
  temp_deviation    — above-baseline temperature accelerates drying
  transpiration_noise — realistic biological + sensor noise

Environmental model:
  air_temperature   — daily sine wave + weekly variation + random walk
  air_humidity      — anti-correlated with temperature + own noise
  light_lux         — bell-curve per day (sunrise/sunset) × cloudiness factor
  soil_temperature  — lags air temperature with thermal mass buffer

Watering logic:
  - Triggered when moisture drops below species threshold (below_threshold)
  - Or on user schedule (scheduled) with some jitter
  - Amount fills soil to target_moisture accounting for drainage/runoff
  - Post-watering moisture rises realistically (absorption rate)
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd

# ── Random seed for reproducibility ─────────────────────────────────────────
RNG_SEED = 2026
rng = np.random.default_rng(RNG_SEED)
random.seed(RNG_SEED)

# ── Output paths ─────────────────────────────────────────────────────────────
DATA_DIR = Path("D:/Web/MoonPlants/moonplants_ml/data")
OUT_READINGS = DATA_DIR / "readings_10min.csv"
OUT_EVENTS   = DATA_DIR / "watering_events.csv"

# ── Simulation range ─────────────────────────────────────────────────────────
SIM_START = datetime(2026, 2, 1, 0, 0, 0, tzinfo=timezone.utc)
SIM_END   = datetime(2026, 7, 31, 23, 50, 0, tzinfo=timezone.utc)
STEP_MIN  = 10  # minutes per reading

# ─────────────────────────────────────────────────────────────────────────────
# Species physical parameters
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SpeciesPhysics:
    species_id: int
    name: str
    # Base drying rate per 10-min step at neutral conditions (moisture units/step)
    k_base: float
    # Threshold below which watering is triggered
    water_threshold: float
    # Target moisture after watering
    target_moisture: float
    # Max moisture (field capacity)
    field_capacity: float
    # How strongly light drives transpiration (0=none, 1=high)
    light_sensitivity: float
    # How strongly VPD drives transpiration
    vpd_sensitivity: float
    # Typical schedule interval in days (user preference, with ±jitter)
    schedule_days: float
    # Wilting point (below this = plant stress, not simulated beyond)
    wilting_point: float
    # Non-linear soil hydraulics: exponent for dry-soil slowdown
    hydraulics_exp: float = 1.4

SPECIES_PHYSICS = {
    728: SpeciesPhysics(    # Aloe vera — drought tolerant, slow drying
        species_id=728, name="aloe",
        k_base=0.00055,         # ~0.055% moisture loss per 10min at neutral
        water_threshold=0.22,
        target_moisture=0.60,
        field_capacity=0.70,
        light_sensitivity=0.30,  # stomata mostly closed
        vpd_sensitivity=0.25,
        schedule_days=8.5,
        wilting_point=0.10,
        hydraulics_exp=1.6,
    ),
    2961: SpeciesPhysics(   # Ficus elastica — moderate, medium drying
        species_id=2961, name="ficus",
        k_base=0.00095,
        water_threshold=0.28,
        target_moisture=0.62,
        field_capacity=0.75,
        light_sensitivity=0.60,
        vpd_sensitivity=0.55,
        schedule_days=7.5,
        wilting_point=0.15,
        hydraulics_exp=1.3,
    ),
    1220: SpeciesPhysics(   # Begonia — moisture-loving, fast drying
        species_id=1220, name="begonia",
        k_base=0.00180,
        water_threshold=0.38,
        target_moisture=0.72,
        field_capacity=0.82,
        light_sensitivity=0.70,
        vpd_sensitivity=0.65,
        schedule_days=3.5,
        wilting_point=0.20,
        hydraulics_exp=1.1,
    ),
}

# ─────────────────────────────────────────────────────────────────────────────
# Plant instance config (matches plant_instances.csv)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PlantInstance:
    plant_instance_id: int
    species_id: int
    device_id: str
    pot_volume_ml: float
    soil_retention_factor: float
    drainage_factor: float
    orientation: str          # window direction → affects light curve
    baseline_air_temp_c: float
    baseline_air_humidity_pct: float
    baseline_light_peak_lux: float
    sensor_dry_raw: int
    sensor_wet_raw: int
    # Per-plant noise multiplier (sensor + physical variability)
    noise_scale: float = 1.0
    # Initial moisture at sim start
    initial_moisture: float = 0.55

PLANTS = [
    PlantInstance(1, 728,  "dev_1301", 1231,  1.00, 0.75, "west_window",  23.4, 40.4, 5630,  332, 818, noise_scale=1.0,  initial_moisture=0.58),
    PlantInstance(2, 728,  "dev_1302", 2286,  0.80, 0.76, "west_window",  20.8, 51.1, 5765,  330, 843, noise_scale=1.1,  initial_moisture=0.52),
    PlantInstance(3, 728,  "dev_1303", 6364,  1.00, 0.73, "east_window",  19.3, 31.4, 6655,  277, 797, noise_scale=0.9,  initial_moisture=0.60),
    PlantInstance(4, 2961, "dev_1304", 856,   1.06, 0.55, "east_window",  21.1, 53.1, 6090,  328, 840, noise_scale=1.2,  initial_moisture=0.55),
    PlantInstance(5, 2961, "dev_1305", 2755,  1.12, 0.64, "west_window",  20.6, 37.7, 6172,  344, 784, noise_scale=0.95, initial_moisture=0.57),
    PlantInstance(6, 2961, "dev_1306", 5445,  1.06, 0.76, "east_window",  21.3, 49.8, 5635,  338, 837, noise_scale=1.05, initial_moisture=0.53),
    PlantInstance(7, 1220, "dev_1307", 1117,  1.00, 0.58, "north_window", 22.2, 50.4, 1413,  314, 841, noise_scale=1.15, initial_moisture=0.65),
    PlantInstance(8, 1220, "dev_1308", 2520,  1.12, 0.60, "west_window",  19.2, 50.4, 2896,  308, 850, noise_scale=1.0,  initial_moisture=0.68),
    PlantInstance(9, 1220, "dev_1309", 6339,  1.12, 0.64, "north_window", 23.5, 61.1, 1465,  330, 817, noise_scale=1.1,  initial_moisture=0.70),
]

# ─────────────────────────────────────────────────────────────────────────────
# Environment simulator
# ─────────────────────────────────────────────────────────────────────────────

class EnvironmentSimulator:
    """
    Simulates realistic indoor environment for a given plant over a timestamp array.
    Uses:
      - Seasonal temperature drift (Feb→Jul: +4°C)
      - Daily sine wave for temperature (+/- 2°C amplitude)
      - Anti-correlated humidity
      - Cloudiness as a Markov chain (clear/cloudy/overcast states)
      - Light as day-bell × (1 - cloud_factor) × orientation_factor
      - Soil temperature as thermal-lag filter of air temperature
    """

    # Cloudiness state transition matrix [clear, cloudy, overcast]
    CLOUD_TRANS = np.array([
        [0.75, 0.20, 0.05],
        [0.25, 0.50, 0.25],
        [0.10, 0.35, 0.55],
    ])
    CLOUD_ATTENUATION = [0.05, 0.45, 0.80]  # fraction of light blocked

    # Orientation → fraction of peak lux available (indoor window geometry)
    ORIENTATION_FACTOR = {
        "south_window": 1.00,
        "west_window":  0.75,
        "east_window":  0.72,
        "north_window": 0.30,
    }

    def __init__(self, plant: PlantInstance, rng: np.random.Generator):
        self.plant = plant
        self.rng = rng
        self.orientation_factor = self.ORIENTATION_FACTOR.get(plant.orientation, 0.7)

    def simulate(self, timestamps: List[datetime]) -> pd.DataFrame:
        n = len(timestamps)
        ts_array = np.array(timestamps)

        # ── Day-of-year fraction for seasonal effects ────────────────────────
        doy = np.array([t.timetuple().tm_yday for t in timestamps], dtype=float)
        # Feb 1 = doy≈32, Jul 31 = doy≈212 → normalise to [0..1] within sim
        doy_frac = (doy - 32) / (212 - 32)  # 0=Feb1, 1=Jul31

        # ── Seasonal baseline temperature (Feb cold → Jul warm) ──────────────
        seasonal_temp = self.plant.baseline_air_temp_c + 4.0 * doy_frac

        # ── Hour of day for daily cycle (UTC hour + fractional minute) ────────
        hour = np.array([t.hour + t.minute / 60.0 for t in timestamps])

        # ── Daily temperature sine wave (peak at 14:00, trough at 04:00) ─────
        daily_temp_amp = 2.2 + 0.8 * doy_frac  # amplitude grows with season
        daily_temp = daily_temp_amp * np.sin(2 * np.pi * (hour - 4.0) / 24.0)

        # ── Slow random walk for multi-day temp variation (±1.5°C over days) ──
        rw_temp = self._random_walk(n, sigma_per_step=0.008, clip=2.0)

        air_temp = seasonal_temp + daily_temp + rw_temp

        # ── Humidity: anti-correlated with temp + own random walk ────────────
        baseline_rh = self.plant.baseline_air_humidity_pct
        # Seasonal: slightly more humid in spring (Feb→Apr), drier in summer
        seasonal_rh = baseline_rh + 8.0 * np.sin(np.pi * doy_frac) - 3.0 * doy_frac
        temp_effect_rh = -1.8 * (air_temp - seasonal_temp)  # warmer → drier
        rw_rh = self._random_walk(n, sigma_per_step=0.05, clip=12.0)
        air_humidity = np.clip(seasonal_rh + temp_effect_rh + rw_rh, 20.0, 90.0)

        # ── Cloudiness Markov chain ───────────────────────────────────────────
        cloud_state, cloud_attenuation = self._simulate_cloudiness(n)

        # ── Light lux: Gaussian bell per day × cloudiness × orientation ──────
        peak_lux = self.plant.baseline_light_peak_lux * self.orientation_factor
        # Seasonal: longer days in summer → wider bell, higher peak
        daylight_hours = 8.0 + 6.0 * doy_frac  # Feb≈8h → Jul≈14h
        sigma_h = daylight_hours / 4.0  # bell width
        solar_noon = 12.5  # UTC noon for indoor context
        # Bell centered at solar_noon
        light_bell = np.exp(-0.5 * ((hour - solar_noon) / sigma_h) ** 2)
        # Only during daylight (rough cut)
        is_day = (hour >= (solar_noon - daylight_hours / 2)) & \
                 (hour <= (solar_noon + daylight_hours / 2))
        light_lux = peak_lux * light_bell * is_day.astype(float) * \
                    (1.0 - cloud_attenuation)
        # Add realistic sensor flicker noise
        light_lux += self.rng.normal(0, 15, n) * is_day.astype(float)
        light_lux = np.clip(light_lux, 0.0, None)

        # ── Soil temperature: thermal lag of air temp ────────────────────────
        soil_temp = self._thermal_lag(air_temp, lag_steps=18, thermal_mass=0.85)

        return pd.DataFrame({
            "timestamp_utc": ts_array,
            "air_temperature_c": np.round(air_temp, 2),
            "air_humidity_pct":  np.round(air_humidity, 1),
            "light_lux":         np.round(light_lux, 1),
            "soil_temperature_c": np.round(soil_temp, 2),
            "cloud_state":        cloud_state,
        })

    def _random_walk(self, n: int, sigma_per_step: float, clip: float) -> np.ndarray:
        steps = self.rng.normal(0, sigma_per_step, n)
        rw = np.cumsum(steps)
        # Mean-reverting clamp
        rw = np.clip(rw - rw.mean(), -clip, clip)
        return rw

    def _simulate_cloudiness(self, n: int) -> Tuple[np.ndarray, np.ndarray]:
        states = np.zeros(n, dtype=int)
        states[0] = self.rng.integers(0, 3)
        for i in range(1, n):
            states[i] = self.rng.choice(3, p=self.CLOUD_TRANS[states[i - 1]])
        attenuation = np.array([self.CLOUD_ATTENUATION[s] for s in states])
        # Add per-step noise to attenuation
        attenuation += self.rng.normal(0, 0.03, n)
        attenuation = np.clip(attenuation, 0.0, 0.95)
        return states, attenuation

    def _thermal_lag(self, air_temp: np.ndarray, lag_steps: int, thermal_mass: float) -> np.ndarray:
        """Exponential moving average to simulate soil thermal inertia."""
        alpha = 1.0 / lag_steps
        soil = np.zeros_like(air_temp)
        soil[0] = air_temp[0] - 1.5  # soil starts slightly cooler
        for i in range(1, len(air_temp)):
            soil[i] = thermal_mass * soil[i - 1] + (1 - thermal_mass) * air_temp[i]
        return soil


# ─────────────────────────────────────────────────────────────────────────────
# Moisture dynamics simulator (physics-based)
# ─────────────────────────────────────────────────────────────────────────────

class MoistureSimulator:
    """
    Simulates realistic soil moisture dynamics.

    The drying model:
      delta_M = -k_base
              * vpd_factor(vpd)
              * light_factor(lux)
              * soil_hydraulics(M)
              * temp_factor(T)
              * pot_factor(pot_volume, retention)
              + noise

    Non-linearities:
      - soil_hydraulics: moisture dries slower when soil is dry
        (matrix potential effect) → shape: M^exp
      - VPD: stomata response is saturating → tanh
      - Light: photosynthetic saturation → sqrt
      - Night: transpiration drops ~80% (stomata close)
    """

    def __init__(self, plant: PlantInstance, sp: SpeciesPhysics, rng: np.random.Generator):
        self.plant = plant
        self.sp = sp
        self.rng = rng

    def compute_vpd(self, T: float, RH: float) -> float:
        """Magnus formula for VPD in kPa."""
        svp = 0.6108 * math.exp(17.27 * T / (T + 237.3))
        return svp * (1.0 - RH / 100.0)

    def drying_rate(
        self, M: float, T: float, RH: float, lux: float, hour: float
    ) -> float:
        """
        Compute instantaneous drying rate (moisture lost per 10-min step).
        All factors are dimensionless multipliers on k_base.
        """
        # VPD factor: more VPD → more evapotranspiration, saturating
        vpd = self.compute_vpd(T, RH)
        vpd_factor = 1.0 + self.sp.vpd_sensitivity * math.tanh(vpd * 2.5)

        # Light factor: drives stomata opening → transpiration
        # sqrt for photosynthetic saturation; normalise by 5000 lux reference
        lux_norm = min(lux / 5000.0, 2.0)
        light_factor = 1.0 + self.sp.light_sensitivity * math.sqrt(lux_norm + 0.01)

        # Night factor: stomata close at night (~80% reduction in transpiration)
        is_daytime = (6.0 <= hour <= 21.0)
        night_multiplier = 1.0 if is_daytime else 0.22

        # Soil hydraulics: dry soil dries slower (reduced hydraulic conductivity)
        # Normalise M relative to field capacity; shape: power law
        M_norm = max(M - self.sp.wilting_point, 0.001) / \
                 (self.sp.field_capacity - self.sp.wilting_point)
        soil_factor = math.pow(M_norm, self.sp.hydraulics_exp)
        soil_factor = max(soil_factor, 0.02)  # never fully stops

        # Temperature deviation from baseline (Q10-like effect)
        temp_dev = T - self.plant.baseline_air_temp_c
        temp_factor = 1.0 + 0.04 * temp_dev  # +4% per °C above baseline

        # Pot volume factor: larger pot → relatively less evaporation per ml
        # (surface area ~ V^(2/3), normalised to 1000ml reference)
        pot_factor = math.pow(1000.0 / max(self.plant.pot_volume_ml, 100), 0.18)

        # Soil retention: denser soil mix retains water longer
        retention_factor = 1.0 / max(self.plant.soil_retention_factor, 0.5)

        rate = (self.sp.k_base
                * vpd_factor
                * light_factor
                * night_multiplier
                * soil_factor
                * temp_factor
                * pot_factor
                * retention_factor)

        return rate

    def apply_watering(
        self, M_before: float, amount_ml: float
    ) -> Tuple[float, float]:
        """
        Compute moisture after watering.
        amount_ml fills soil; runoff = fraction that drains immediately.
        Returns (M_after, actual_runoff_fraction).
        """
        # How much moisture can the soil absorb?
        max_absorbable_ml = (self.sp.field_capacity - M_before) * \
                            self.plant.pot_volume_ml * self.plant.soil_retention_factor
        # Water that exceeds saturation → runoff
        absorbed_ml = min(amount_ml * self.plant.drainage_factor, max_absorbable_ml)
        delta_M = absorbed_ml / (self.plant.pot_volume_ml * self.plant.soil_retention_factor)
        M_after = min(M_before + delta_M, self.sp.field_capacity)
        runoff_fraction = 1.0 - (absorbed_ml / max(amount_ml, 1.0))
        return M_after, max(runoff_fraction, 0.0)

    def recommended_amount(self, M_before: float) -> float:
        """
        How much water (ml) is needed to bring moisture to target_moisture?
        Accounts for drainage and pot volume.
        """
        delta = max(self.sp.target_moisture - M_before, 0.0)
        needed_ml = (delta * self.plant.pot_volume_ml * self.plant.soil_retention_factor
                     / self.plant.drainage_factor)
        # Add small random variation (±8%) to simulate user imprecision
        jitter = 1.0 + self.rng.normal(0, 0.08)
        return max(needed_ml * jitter, 5.0)


# ─────────────────────────────────────────────────────────────────────────────
# Full simulation for one plant
# ─────────────────────────────────────────────────────────────────────────────

def simulate_plant(
    plant: PlantInstance,
    timestamps: List[datetime],
    rng: np.random.Generator,
    verbose: bool = False,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Run full simulation for one plant.
    Returns (readings_df, events_df) — NO watering columns in readings.
    """
    sp   = SPECIES_PHYSICS[plant.species_id]
    env  = EnvironmentSimulator(plant, rng)
    mois = MoistureSimulator(plant, sp, rng)

    env_df = env.simulate(timestamps)
    n = len(timestamps)

    # ── State variables ──────────────────────────────────────────────────────
    M = plant.initial_moisture   # current soil moisture
    soil_temp_state = env_df["soil_temperature_c"].iloc[0]

    # ── Watering schedule ────────────────────────────────────────────────────
    schedule_interval = timedelta(days=sp.schedule_days)
    # Next scheduled watering (with ±12h jitter)
    jitter_h = rng.uniform(-12, 12)
    next_scheduled = timestamps[0] + schedule_interval + timedelta(hours=float(jitter_h))

    # ── Output buffers ───────────────────────────────────────────────────────
    moisture_series   = np.zeros(n)
    soil_raw_series   = np.zeros(n, dtype=int)

    events: List[dict] = []
    event_id_counter = [1]

    # ── Sensor noise model (correlated noise with drift) ─────────────────────
    # Sensor has: white noise + slow drift + occasional spikes
    sensor_noise = rng.normal(0, 0.003 * plant.noise_scale, n)
    # Slow drift: random walk with mean reversion
    drift = np.zeros(n)
    drift[0] = 0.0
    for i in range(1, n):
        drift[i] = 0.98 * drift[i - 1] + rng.normal(0, 0.0008 * plant.noise_scale)
    drift = np.clip(drift, -0.015, 0.015)
    # Occasional sensor spike (0.3% of readings)
    spike_mask = rng.random(n) < 0.003
    spikes = rng.choice([-1, 1], n) * rng.uniform(0.02, 0.06, n) * spike_mask

    # ── Simulate step by step ────────────────────────────────────────────────
    for i, ts in enumerate(timestamps):
        row = env_df.iloc[i]
        T   = float(row["air_temperature_c"])
        RH  = float(row["air_humidity_pct"])
        lux = float(row["light_lux"])
        hour = ts.hour + ts.minute / 60.0

        # Check watering conditions BEFORE recording
        watered_this_step = False
        reason = None

        # 1. Below-threshold trigger
        if M < sp.water_threshold and i > 0:
            # Check if last event was recent enough (don't re-water immediately)
            last_event_ts = events[-1]["_ts_dt"] if events else None
            min_gap = timedelta(hours=2)
            if last_event_ts is None or (ts - last_event_ts) > min_gap:
                amount_ml = mois.recommended_amount(M)
                M_after, runoff = mois.apply_watering(M, amount_ml)
                events.append({
                    "event_id": event_id_counter[0],
                    "timestamp_utc": ts.strftime("%Y-%m-%dT%H:%M:%S+0000"),
                    "_ts_dt": ts,
                    "plant_instance_id": plant.plant_instance_id,
                    "species_id": plant.species_id,
                    "reason": "below_threshold",
                    "amount_ml": round(amount_ml, 1),
                    "moisture_before": round(M, 4),
                    "moisture_after": round(M_after, 4),
                    "target_moisture": round(sp.target_moisture, 4),
                    "runoff_fraction": round(runoff, 3),
                })
                event_id_counter[0] += 1
                M = M_after
                # Update next scheduled watering after reactive one
                jitter_h = float(rng.uniform(-10, 10))
                next_scheduled = ts + schedule_interval + timedelta(hours=jitter_h)
                watered_this_step = True
                reason = "below_threshold"

        # 2. Scheduled watering
        if not watered_this_step and ts >= next_scheduled:
            # Only water during daytime (6:00–20:00)
            if 6 <= ts.hour <= 20:
                amount_ml = mois.recommended_amount(M)
                # Scheduled watering may not fill completely (user pours fixed amount)
                amount_ml *= rng.uniform(0.85, 1.15)
                M_after, runoff = mois.apply_watering(M, amount_ml)
                events.append({
                    "event_id": event_id_counter[0],
                    "timestamp_utc": ts.strftime("%Y-%m-%dT%H:%M:%S+0000"),
                    "_ts_dt": ts,
                    "plant_instance_id": plant.plant_instance_id,
                    "species_id": plant.species_id,
                    "reason": "scheduled",
                    "amount_ml": round(amount_ml, 1),
                    "moisture_before": round(M, 4),
                    "moisture_after": round(M_after, 4),
                    "target_moisture": round(sp.target_moisture, 4),
                    "runoff_fraction": round(runoff, 3),
                })
                event_id_counter[0] += 1
                M = M_after
                jitter_h = float(rng.uniform(-14, 14))
                next_scheduled = ts + schedule_interval + timedelta(hours=jitter_h)
                watered_this_step = True
                reason = "scheduled"

        # Record current moisture (with sensor noise)
        M_observed = float(np.clip(M + sensor_noise[i] + drift[i] + spikes[i], 0.0, 1.0))
        moisture_series[i] = M_observed

        # Raw sensor ADC value (linear mapping with plant-specific calibration)
        # raw = dry_raw + (wet_raw - dry_raw) * M  (inverted: wet=higher raw)
        raw_val = plant.sensor_dry_raw + (plant.sensor_wet_raw - plant.sensor_dry_raw) * M_observed
        raw_val += int(rng.normal(0, 2))  # ADC quantisation noise
        soil_raw_series[i] = int(np.clip(raw_val, plant.sensor_dry_raw - 10,
                                          plant.sensor_wet_raw + 10))

        # Advance moisture physics (if not watered this step)
        if not watered_this_step:
            rate = mois.drying_rate(M, T, RH, lux, hour)
            # Add correlated biological noise (stomatal variation ~5% of rate)
            bio_noise = rng.normal(0, 0.05 * rate)
            M = float(np.clip(M - rate + bio_noise, sp.wilting_point, sp.field_capacity))

    # ── Build readings DataFrame ─────────────────────────────────────────────
    readings = pd.DataFrame({
        "timestamp_utc":       [t.strftime("%Y-%m-%dT%H:%M:%S+0000") for t in timestamps],
        "device_id":           plant.device_id,
        "plant_instance_id":   plant.plant_instance_id,
        "species_id":          plant.species_id,
        "soil_moisture":       np.round(moisture_series, 4),
        "soil_moisture_raw":   soil_raw_series,
        "soil_temperature_c":  env_df["soil_temperature_c"].values,
        "air_temperature_c":   env_df["air_temperature_c"].values,
        "air_humidity_pct":    env_df["air_humidity_pct"].values,
        "light_lux":           env_df["light_lux"].values,
    })

    events_clean = [{k: v for k, v in e.items() if k != "_ts_dt"} for e in events]
    events_df = pd.DataFrame(events_clean) if events_clean else pd.DataFrame(columns=[
        "event_id","timestamp_utc","plant_instance_id","species_id",
        "reason","amount_ml","moisture_before","moisture_after",
        "target_moisture","runoff_fraction",
    ])

    if verbose:
        print(f"  Plant {plant.plant_instance_id} ({sp.name:8s}): "
              f"{len(events_df):3d} events | "
              f"moisture range [{moisture_series.min():.3f}, {moisture_series.max():.3f}] | "
              f"mean={moisture_series.mean():.3f}")

    return readings, events_df


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("MoonPlants — Realistic Data Generator")
    print(f"Period: {SIM_START.date()} → {SIM_END.date()}")
    print("=" * 60)

    # Build timestamp array
    ts_list: List[datetime] = []
    t = SIM_START
    while t <= SIM_END:
        ts_list.append(t)
        t += timedelta(minutes=STEP_MIN)
    print(f"Timestamps: {len(ts_list)} steps × {STEP_MIN} min = "
          f"{len(ts_list)*STEP_MIN/60/24:.1f} days")

    all_readings: List[pd.DataFrame] = []
    all_events:   List[pd.DataFrame] = []
    event_id_offset = 0

    print("\nSimulating plants:")
    for plant in PLANTS:
        # Give each plant a unique RNG stream (reproducible but independent)
        plant_rng = np.random.default_rng(RNG_SEED + plant.plant_instance_id * 137)
        readings_df, events_df = simulate_plant(plant, ts_list, plant_rng, verbose=True)
        all_readings.append(readings_df)
        if not events_df.empty:
            events_df["event_id"] = events_df["event_id"] + event_id_offset
            event_id_offset += len(events_df)
            all_events.append(events_df)

    # ── Combine ──────────────────────────────────────────────────────────────
    readings_all = pd.concat(all_readings, ignore_index=True)
    readings_all = readings_all.sort_values(
        ["plant_instance_id", "timestamp_utc"]
    ).reset_index(drop=True)

    events_all = pd.concat(all_events, ignore_index=True)
    events_all = events_all.sort_values(
        ["plant_instance_id", "timestamp_utc"]
    ).reset_index(drop=True)
    # Reassign global event_id
    events_all["event_id"] = range(1, len(events_all) + 1)

    # ── Save ─────────────────────────────────────────────────────────────────
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    readings_all.to_csv(OUT_READINGS, index=False)
    events_all.to_csv(OUT_EVENTS, index=False)

    print(f"\n{'='*60}")
    print(f"Readings saved → {OUT_READINGS}")
    print(f"  Rows: {len(readings_all):,}  |  Columns: {list(readings_all.columns)}")
    print(f"Events  saved → {OUT_EVENTS}")
    print(f"  Rows: {len(events_all):,}  |  Columns: {list(events_all.columns)}")
    print(f"\nEvent summary by species:")
    summary = events_all.merge(
        pd.DataFrame([{"plant_instance_id": p.plant_instance_id,
                       "species_id": p.species_id} for p in PLANTS]),
        on="plant_instance_id"
    ).groupby("species_id_x").agg(
        n_events=("event_id","count"),
        mean_amount=("amount_ml","mean"),
        mean_moisture_before=("moisture_before","mean"),
        mean_moisture_after=("moisture_after","mean"),
    ).round(2)
    print(summary.to_string())
    print(f"\nTotal events: {len(events_all)}")
    print(f"Events per plant range: "
          f"{events_all.groupby('plant_instance_id').size().min()}–"
          f"{events_all.groupby('plant_instance_id').size().max()}")


if __name__ == "__main__":
    main()





