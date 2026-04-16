from supabase import create_client, Client
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Optional

WATERING_MAP = {"Minimum": 1, "Average": 2, "Frequent": 3}


class SupabaseDataClient:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)

    def fetch_all(self, plant_uuid: str, reference_time: datetime) -> dict:
        """
        Повертає dict з ключами: readings, watering_events, plant_instances, species
        У форматі що очікує build_features() з research коду.
        """
        plant_row   = self._fetch_plant(plant_uuid)
        readings    = self._fetch_measurements(plant_uuid, reference_time)
        events      = self._fetch_watering_events(plant_uuid)
        species_row = self._fetch_species(plant_row.get("species_cache_id"))

        plant_int_id = self._uuid_to_int(plant_uuid)

        plant_instances = self._normalize_plant(plant_row, plant_int_id)
        species_df      = self._normalize_species(species_row, plant_row)
        readings_df     = self._normalize_measurements(readings, plant_int_id, plant_row)
        events_df       = self._normalize_events(events, plant_int_id)

        return {
            "plant_int_id": plant_int_id,
            "readings": readings_df,
            "watering_events": events_df,
            "plant_instances": plant_instances,
            "species": species_df,
        }

    def _fetch_plant(self, plant_uuid: str) -> dict:
        res = self.client.table("plants").select("*").eq("id", plant_uuid).single().execute()
        return res.data

    def _fetch_measurements(self, plant_uuid: str, reference_time: datetime) -> list:
        since = (reference_time - timedelta(days=10)).isoformat()
        res = (
            self.client.table("measurements")
            .select("measured_at,soil_moisture_pct,air_temp_c,air_humidity_pct,light_lux,soil_moisture_raw,device_id")
            .eq("plant_id", plant_uuid)
            .gte("measured_at", since)
            .lte("measured_at", reference_time.isoformat())
            .order("measured_at")
            .execute()
        )
        return res.data

    def _fetch_watering_events(self, plant_uuid: str) -> list:
        res = (
            self.client.table("watering_events")
            .select("happened_at,water_ml")
            .eq("plant_id", plant_uuid)
            .order("happened_at")
            .execute()
        )
        return res.data

    def _fetch_species(self, species_cache_id: Optional[str]) -> Optional[dict]:
        if not species_cache_id:
            return None
        res = self.client.table("species_cache").select("*").eq("id", species_cache_id).single().execute()
        return res.data

    @staticmethod
    def _uuid_to_int(uuid_str: str) -> int:
        """Стабільний int з UUID (для ML коду що очікує int ID)."""
        return abs(hash(uuid_str)) % (10**9)

    def _normalize_measurements(self, rows: list, plant_int_id: int, plant_row: dict) -> pd.DataFrame:
        if not rows:
            raise ValueError("No measurements found for plant")
        df = pd.DataFrame(rows)
        df = df.rename(columns={
            "measured_at": "timestamp_utc",
            "air_temp_c": "air_temperature_c",
        })
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
        df["soil_moisture"] = df["soil_moisture_pct"].astype(float) / 100.0
        df["soil_moisture_raw"] = df.get("soil_moisture_raw", pd.Series(dtype=float)).fillna(0).astype(int)
        df["plant_instance_id"] = plant_int_id
        df["species_id"] = self._uuid_to_int(plant_row.get("species_cache_id") or "default")
        df["device_id"] = df.get("device_id", pd.Series(dtype=str)).fillna("unknown")
        for col in ["air_humidity_pct", "light_lux", "air_temperature_c"]:
            if col not in df.columns:
                df[col] = 0.0
            else:
                df[col] = df[col].astype(float).fillna(0.0)
        return df[["timestamp_utc", "device_id", "plant_instance_id", "species_id",
                   "soil_moisture", "soil_moisture_raw", "air_temperature_c",
                   "air_humidity_pct", "light_lux"]].sort_values("timestamp_utc").reset_index(drop=True)

    def _normalize_events(self, rows: list, plant_int_id: int) -> pd.DataFrame:
        if not rows:
            return pd.DataFrame(columns=["timestamp_utc", "plant_instance_id", "amount_ml"])
        df = pd.DataFrame(rows)
        df = df.rename(columns={"happened_at": "timestamp_utc", "water_ml": "amount_ml"})
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
        df["plant_instance_id"] = plant_int_id
        df["amount_ml"] = df["amount_ml"].fillna(0).astype(float)
        return df[["timestamp_utc", "plant_instance_id", "amount_ml"]].sort_values("timestamp_utc").reset_index(drop=True)

    def _normalize_plant(self, plant_row: dict, plant_int_id: int) -> pd.DataFrame:
        from app.config import DEFAULT_CONFIG
        d = DEFAULT_CONFIG.plant_defaults
        return pd.DataFrame([{
            "plant_instance_id": plant_int_id,
            "species_id": self._uuid_to_int(plant_row.get("species_cache_id") or "default"),
            "pot_volume_ml": plant_row.get("pot_volume_ml") or 1000,
            "soil_retention_factor": d.soil_retention_factor,
            "drainage_factor": d.drainage_factor,
            "sensor_dry_raw": d.sensor_dry_raw,
            "sensor_wet_raw": d.sensor_wet_raw,
            "baseline_air_temp_c": d.baseline_air_temp_c,
            "baseline_air_humidity_pct": d.baseline_air_humidity_pct,
        }])

    def _normalize_species(self, species_row: Optional[dict], plant_row: dict) -> pd.DataFrame:
        from app.config import DEFAULT_CONFIG
        d = DEFAULT_CONFIG.plant_defaults
        watering_text = (species_row or {}).get("watering", "Average") or "Average"
        watering_num = WATERING_MAP.get(watering_text, 2)

        if watering_text == "Minimum":
            days_min, days_max = 10.0, 20.0
        elif watering_text == "Frequent":
            days_min, days_max = 2.0, 5.0
        else:
            days_min, days_max = d.watering_benchmark_days_min, d.watering_benchmark_days_max

        species_int_id = self._uuid_to_int(plant_row.get("species_cache_id") or "default")
        return pd.DataFrame([{
            "species_id": species_int_id,
            "watering_benchmark_days_min": days_min,
            "watering_benchmark_days_max": days_max,
            "watering_category_num": watering_num,
            "drought_tolerant": d.drought_tolerant,
            "watering": watering_text,
        }])
