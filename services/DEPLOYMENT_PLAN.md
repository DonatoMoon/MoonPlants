# ПЛАН: Реструктуризація ML + Railway деплой

> **Контекст:** Проект MoonPlants (монорепо на GitHub). Модель: LightGBM (3 моделі: trajectory, tte, amount).  
> Мета: `services/moonplants_ml/` = дослідження, `services/moonplants_api/` = Railway.  
> Next.js на Vercel → викликає FastAPI на Railway → Supabase.

---

## ПОТОЧНИЙ СТАН (аудит)

**Моделі (pkl, готові до продакшну):**
```
services/moonplants_ml/artifacts/models/
  trajectory_model.pkl   503 KB
  tte_model.pkl          2.8 MB
  amount_model.pkl       158 KB
```

**Ключова невідповідність схем (Research CSV ↔ Supabase prod):**

| Що потрібно коду | CSV (дослідження) | Supabase (продакшн) |
|---|---|---|
| ID рослини | `plant_instance_id` (INT) | `plants.id` (UUID) |
| Вологість ґрунту | `soil_moisture` (0.0–1.0) | `soil_moisture_pct` (0–100) → ÷100 |
| Час вимірювання | `timestamp_utc` | `measured_at` |
| Температура повітря | `air_temperature_c` | `air_temp_c` |
| Кількість води | `amount_ml` | `water_ml` |
| Час поливу | `timestamp_utc` | `happened_at` |
| `soil_retention_factor` | є в CSV | **НЕМАЄ** в Supabase → default 0.5 |
| `drainage_factor` | є в CSV | **НЕМАЄ** в Supabase → default 0.3 |
| `sensor_dry_raw` | є в CSV | **НЕМАЄ** → default 1500 |
| `sensor_wet_raw` | є в CSV | **НЕМАЄ** → default 500 |
| `watering_benchmark_days_min/max` | є в species.csv | **НЕМАЄ** в species_cache → default 5/10 |
| `drought_tolerant` | є в species.csv | **НЕМАЄ** → default False |
| `watering_category_num` | є (derived) | з `species_cache.watering` text |

**Supabase таблиці що будемо читати:**
- `measurements` — сенсорні дані (10-хв)
- `watering_events` — події поливу
- `plants` — метадані рослини
- `species_cache` — дані видів

**Supabase таблиця де зберігатимемо результат:**
- `predictions` — колонки: `plant_id`, `next_watering_at`, `recommended_water_ml`, `confidence` (0–1), `model` (TEXT), `details` (JSONB)

---

## КРОК 1: Очистка `services/moonplants_ml/`

**Сесія:** 1 | **Складність:** Легко

### Що видалити

```
services/moonplants_ml/api/                     ← всі 3 файли порожні, видалити папку
services/moonplants_ml/src/train_dl_diploma.py   ← DL не обрано
services/moonplants_ml/src/train_dl_diploma_v2.py
services/moonplants_ml/src/test.ipynb           ← test notebook поза місцем
services/moonplants_ml/test_output.txt
services/moonplants_ml/artifacts/diploma/models/gru.pth       ← не потрібно
services/moonplants_ml/artifacts/diploma/models/lstm.pth
services/moonplants_ml/artifacts/diploma/models/lstm_v2.pth
services/moonplants_ml/artifacts/diploma/models/randomforest.pkl  ← не обрано
services/moonplants_ml/artifacts/diploma/models/linearregression.pkl
```

### Оновити `.gitignore` у корені проекту

Розкоментувати Python секцію (зараз закоментована). Файл: `D:\Web\MoonPlants\.gitignore`, рядки 27–38.  
Також додати:
```gitignore
# Python / ML
__pycache__/
*.py[cod]
*$py.class
/services/**/.pytest_cache/
/services/**/.venv/
/services/**/venv/
/services/**/*.log
/services/**/artifacts/features_cache.parquet
/services/**/test_output.txt
```

**НЕ ігнорувати:** `artifacts/models/*.pkl` — вони малі (3.5 MB всього) і потрібні Railway.

### Фінальна структура дослідницької папки

```
services/moonplants_ml/
├── src/                         ← ML код (training pipeline)
│   ├── config/settings.py
│   ├── data/loaders.py, validators.py
│   ├── evaluation/metrics.py, plots.py
│   ├── features/engineering.py, splitting.py
│   ├── models/amount_model.py, baselines.py, trajectory_model.py, tte_model.py
│   ├── pipelines/train.py, predict.py
│   ├── analyze_lgbm.py, optimize_lgbm.py, shap_analysis.py
├── data/
│   ├── diploma/                 ← дані для диплому
│   ├── archive_jan2026/
│   └── *.csv                   ← поточні дані
├── artifacts/
│   ├── diploma/                 ← метрики і плоти диплому
│   └── models/                  ← ← ВАЖЛИВО: ці pkl потрібні для копіювання в api
├── notebooks/
├── research/
├── scripts/
├── tests/
├── DIPLOMA_PLAN.md, DIPLOMA_RESEARCH_SUMMARY.md
├── DOMAIN_CONTEXT.md, TECHNICAL_REFERENCE.md, INTEGRATION_PLAN.md
└── pytest.ini, run_tests.py
```

---

## КРОК 2: Створення скелету `services/moonplants_api/`

**Сесія:** 1–2 | **Складність:** Легко

### Команди (виконати з кореня проекту)

```bash
mkdir -p services/moonplants_api/app
mkdir -p services/moonplants_api/models
touch services/moonplants_api/app/__init__.py
touch services/moonplants_api/app/main.py
touch services/moonplants_api/app/schemas.py
touch services/moonplants_api/app/predictor.py
touch services/moonplants_api/app/features.py
touch services/moonplants_api/app/data_client.py
touch services/moonplants_api/app/config.py
```

### Скопіювати моделі

```bash
cp services/moonplants_ml/artifacts/models/trajectory_model.pkl services/moonplants_api/models/
cp services/moonplants_ml/artifacts/models/tte_model.pkl services/moonplants_api/models/
cp services/moonplants_ml/artifacts/models/amount_model.pkl services/moonplants_api/models/
```

### `services/moonplants_api/requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
lightgbm==4.5.0
pandas==2.2.3
numpy==1.26.4
scikit-learn==1.4.2
supabase==2.10.0
python-dotenv==1.0.1
pydantic==2.9.0
```

### `services/moonplants_api/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### `services/moonplants_api/.env.example` (для документації, не коміттити .env)

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhb...   # service_role key з Supabase Dashboard → Settings → API
API_SECRET_KEY=my-random-secret-key-here
```

---

## КРОК 3: `app/config.py` і `app/schemas.py`

**Сесія:** 2 | **Складність:** Легко

### `services/moonplants_api/app/config.py`

Спрощена версія конфігу без CSV шляхів. Скопіювати з `moonplants_ml/src/config/settings.py` тільки ML параметри:

```python
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
```

### `services/moonplants_api/app/schemas.py`

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PredictRequest(BaseModel):
    plant_id: str                           # UUID рослини (з Supabase plants.id)
    reference_time: Optional[datetime] = None  # UTC, defaults to now

class PredictResponse(BaseModel):
    plant_id: str
    timestamp: str
    current_moisture: float                 # 0.0–1.0
    time_to_water_hours: float
    recommended_ml: float
    confidence: str                         # "high" | "medium" | "low"
    trajectory_hours: Optional[float]
    tte_pred_hours: float
    low_threshold: float
    high_target: float
    rationale: str

class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
```

**Важливо:** API приймає `plant_id` (UUID string), не `plant_instance_id` (INT).  
Внутрішньо в predictor.py ми маппимо UUID → int для сумісності з ML кодом.

---

## КРОК 4: `app/data_client.py` — Supabase fetch + нормалізація

**Сесія:** 3 | **Складність:** СКЛАДНО (ключова частина)

Цей файл відповідає за: отримати дані з Supabase → перетворити у формат, що очікує feature engineering.

### Структура

```python
# services/moonplants_api/app/data_client.py
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
        plant_row  = self._fetch_plant(plant_uuid)
        readings   = self._fetch_measurements(plant_uuid, reference_time)
        events     = self._fetch_watering_events(plant_uuid)
        species_row = self._fetch_species(plant_row.get("species_cache_id"))

        # plant_instance_id = хеш UUID (стабільний int для ML коду)
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
        # Беремо останні 10 днів (достатньо для lag_144 = 144*10min = 24h)
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
        # Rename columns → research format
        df = df.rename(columns={
            "measured_at": "timestamp_utc",
            "air_temp_c": "air_temperature_c",
        })
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
        # Normalize moisture 0–100 → 0.0–1.0
        df["soil_moisture"] = df["soil_moisture_pct"].astype(float) / 100.0
        df["soil_moisture_raw"] = df.get("soil_moisture_raw", 0).fillna(0).astype(int)
        df["plant_instance_id"] = plant_int_id
        df["species_id"] = self._uuid_to_int(plant_row.get("species_cache_id") or "default")
        df["device_id"] = df.get("device_id", "unknown").fillna("unknown")
        # Fill missing sensor columns with 0
        for col in ["air_humidity_pct", "light_lux", "air_temperature_c"]:
            if col not in df.columns:
                df[col] = 0.0
            else:
                df[col] = df[col].astype(float).fillna(0.0)
        return df[["timestamp_utc","device_id","plant_instance_id","species_id",
                   "soil_moisture","soil_moisture_raw","air_temperature_c",
                   "air_humidity_pct","light_lux"]].sort_values("timestamp_utc").reset_index(drop=True)

    def _normalize_events(self, rows: list, plant_int_id: int) -> pd.DataFrame:
        if not rows:
            return pd.DataFrame(columns=["timestamp_utc","plant_instance_id","amount_ml"])
        df = pd.DataFrame(rows)
        df = df.rename(columns={"happened_at": "timestamp_utc", "water_ml": "amount_ml"})
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], utc=True)
        df["plant_instance_id"] = plant_int_id
        df["amount_ml"] = df["amount_ml"].fillna(0).astype(float)
        return df[["timestamp_utc","plant_instance_id","amount_ml"]].sort_values("timestamp_utc").reset_index(drop=True)

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

        # Estimate benchmark days from watering text
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
```

---

## КРОК 5: `app/features.py` — Feature Engineering для inference

**Сесія:** 4 | **Складність:** Середня

**Суть:** Повністю скопіювати `services/moonplants_ml/src/features/engineering.py` в `app/features.py`.

**Єдина зміна:** виправити import на відносний:
```python
# Змінити:
from src.config.settings import Config, DEFAULT_CONFIG
# На:
from app.config import Config, DEFAULT_CONFIG
```

**Перевірка:** Після копіювання функція `build_features(..., add_targets=False)` повинна працювати без CSV.

---

## КРОК 6: `app/predictor.py` — Inference логіка

**Сесія:** 4 | **Складність:** Середня

```python
# services/moonplants_api/app/predictor.py
import pickle, logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
import numpy as np
import pandas as pd

from app.config import DEFAULT_CONFIG
from app.features import build_features
from app.data_client import SupabaseDataClient

MODELS_DIR = Path(__file__).parent.parent / "models"
logger = logging.getLogger(__name__)

class Predictor:
    def __init__(self):
        self.traj_model = None
        self.tte_model  = None
        self.amt_model  = None
        self.data_client: Optional[SupabaseDataClient] = None
        self._loaded = False

    def load(self, supabase_url: str, supabase_key: str):
        with open(MODELS_DIR / "trajectory_model.pkl", "rb") as f:
            self.traj_model = pickle.load(f)
        with open(MODELS_DIR / "tte_model.pkl", "rb") as f:
            self.tte_model = pickle.load(f)
        with open(MODELS_DIR / "amount_model.pkl", "rb") as f:
            self.amt_model = pickle.load(f)
        self.data_client = SupabaseDataClient(supabase_url, supabase_key)
        self._loaded = True
        logger.info("Models loaded. traj=%s, tte=%s, amt=%s",
                    type(self.traj_model).__name__,
                    type(self.tte_model).__name__,
                    type(self.amt_model).__name__)

    def predict(self, plant_uuid: str, reference_time: Optional[datetime] = None) -> dict:
        if not self._loaded:
            raise RuntimeError("Models not loaded. Call .load() first.")
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        cfg = DEFAULT_CONFIG
        data = self.data_client.fetch_all(plant_uuid, reference_time)
        plant_int_id = data["plant_int_id"]

        feat = build_features(
            readings=data["readings"],
            watering_events=data["watering_events"],
            plant_instances=data["plant_instances"],
            species=data["species"],
            cfg=cfg,
            add_targets=False,
        )

        if feat.empty:
            raise ValueError(f"No features built for plant {plant_uuid}")

        snapshot = feat.sort_values("timestamp_utc").iloc[-1]
        current_moisture = float(snapshot["soil_moisture"])

        # Thresholds from species
        watering = data["species"]["watering"].iloc[0] if len(data["species"]) else "Average"
        if watering == "Minimum":
            low_thr, high_tgt = 0.20, 0.55
        elif watering == "Frequent":
            low_thr, high_tgt = 0.35, 0.70
        else:
            low_thr, high_tgt = cfg.trajectory_model.default_low_threshold, cfg.trajectory_model.default_high_target

        # Trajectory model
        traj_hours, pred_moisture_h = self.traj_model.find_time_to_threshold(snapshot, low_threshold=low_thr)

        # TTE model
        X_snap = pd.DataFrame([snapshot])
        tte_hours = float(self.tte_model.predict_with_bias(X_snap, plant_int_id)[0])

        # Ensemble
        if traj_hours is not None:
            ensemble_hours = 0.7 * traj_hours + 0.3 * tte_hours
            confidence = "high" if abs(traj_hours - tte_hours) < 12 else "medium"
        else:
            ensemble_hours = tte_hours
            confidence = "low"
        ensemble_hours = max(0.0, ensemble_hours)

        # Amount
        target_moisture = (low_thr + high_tgt) / 2.0
        recommended_ml = self.amt_model.recommend_amount(snapshot, target_moisture, plant_int_id)

        rationale = (
            f"Current moisture: {current_moisture:.3f} | "
            f"Trajectory: {f'{traj_hours:.1f}h' if traj_hours else 'no threshold crossing'} | "
            f"TTE: {tte_hours:.1f}h | "
            f"Ensemble: {ensemble_hours:.1f}h ({confidence}) | "
            f"Recommended: {recommended_ml:.0f}ml"
        )

        return {
            "plant_id": plant_uuid,
            "timestamp": reference_time.isoformat(),
            "current_moisture": round(current_moisture, 4),
            "time_to_water_hours": round(ensemble_hours, 2),
            "recommended_ml": round(recommended_ml, 1),
            "confidence": confidence,
            "trajectory_hours": round(float(traj_hours), 2) if traj_hours is not None else None,
            "tte_pred_hours": round(float(tte_hours), 2),
            "low_threshold": low_thr,
            "high_target": high_tgt,
            "rationale": rationale,
        }
```

---

## КРОК 7: `app/main.py` — FastAPI app

**Сесія:** 4–5 | **Складність:** Середня

```python
# services/moonplants_api/app/main.py
import os, logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import PredictRequest, PredictResponse, HealthResponse
from app.predictor import Predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")

predictor = Predictor()
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=True)

def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    expected = os.environ.get("API_SECRET_KEY", "")
    if not expected or api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")

@asynccontextmanager
async def lifespan(app: FastAPI):
    predictor.load(
        supabase_url=os.environ["SUPABASE_URL"],
        supabase_key=os.environ["SUPABASE_SERVICE_KEY"],
    )
    yield

app = FastAPI(
    title="MoonPlants ML API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://*.vercel.app", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", models_loaded=predictor._loaded)

@app.post("/api/v1/predict", response_model=PredictResponse)
def predict(request: PredictRequest, _=Depends(verify_api_key)):
    try:
        result = predictor.predict(
            plant_uuid=request.plant_id,
            reference_time=request.reference_time,
        )
        return PredictResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
```

---

## КРОК 8: Деплой на Railway

**Сесія:** 5 | **Складність:** Середня

### Підготовка

1. Перевірити що `services/moonplants_api/models/*.pkl` закомітчені до git.
2. Перевірити що `.env` файл НЕ закомічений (він в .gitignore).
3. Push до GitHub:
   ```bash
   git add services/moonplants_api/
   git commit -m "feat: add ML API service for Railway deployment"
   git push origin main
   ```

### Railway налаштування

1. Відкрити [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Вибрати репозиторій `DonatoMoon/MoonPlants`
3. **Settings → Source → Root Directory:** вказати `services/moonplants_api`
4. **Variables** (додати всі три):
   ```
   SUPABASE_URL         = https://xxxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJhbGc...   (service_role з Supabase Dashboard → Settings → API)
   API_SECRET_KEY       = <генерувати: python -c "import secrets; print(secrets.token_hex(32))">
   ```
5. Railway автоматично запустить deploy через Nixpacks (детектує Python).
6. **Networking → Generate Domain** — отримати URL типу `https://moonplants-api-production.up.railway.app`

### Перевірка після деплою

```bash
# Health check
curl https://moonplants-api-production.up.railway.app/health
# Очікувано: {"status":"ok","models_loaded":true}

# Predict
curl -X POST https://moonplants-api-production.up.railway.app/api/v1/predict \
  -H "X-API-Key: YOUR_API_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"plant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}'
```

---

## КРОК 9: Next.js інтеграція (Vercel)

**Сесія:** 6 | **Складність:** Легко

### Vercel Environment Variables

Додати в Vercel Dashboard → Project → Settings → Environment Variables:
```
MOONPLANTS_ML_API_URL = https://moonplants-api-production.up.railway.app
MOONPLANTS_ML_API_KEY = <той самий API_SECRET_KEY що в Railway>
```

### Новий Route Handler

Файл: `apps/web/app/api/v1/plants/[id]/prediction/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // id = plant UUID

  const mlApiUrl = process.env.MOONPLANTS_ML_API_URL
  const mlApiKey = process.env.MOONPLANTS_ML_API_KEY

  if (!mlApiUrl || !mlApiKey) {
    return NextResponse.json({ error: 'ML API not configured' }, { status: 503 })
  }

  const response = await fetch(`${mlApiUrl}/api/v1/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': mlApiKey,
    },
    body: JSON.stringify({ plant_id: id }),
    // Cache: revalidate кожні 30 хвилин (прогноз не змінюється часто)
    next: { revalidate: 1800 },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    return NextResponse.json(
      { error: err.detail ?? 'Prediction failed' },
      { status: response.status }
    )
  }

  const data = await response.json()
  return NextResponse.json(data)
}
```

### Використання в UI

Звертатися до `/api/v1/plants/{plantId}/prediction` з client або server component.

Приклад server component:
```typescript
const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/plants/${plantId}/prediction`)
const prediction = await res.json()
// prediction.time_to_water_hours, prediction.recommended_ml, prediction.confidence
```

---

## ОПЦІОНАЛЬНО: Зберігати прогнози в Supabase (після Кроку 8)

В `predictor.py` після отримання `result` — зберігати в таблицю `predictions`:

```python
from datetime import timedelta

def save_prediction(self, plant_uuid: str, result: dict):
    """Опціонально: зберегти прогноз в Supabase."""
    from datetime import timedelta
    next_watering_at = (
        datetime.fromisoformat(result["timestamp"]) +
        timedelta(hours=result["time_to_water_hours"])
    ).isoformat()
    confidence_map = {"high": 0.85, "medium": 0.60, "low": 0.40}
    self.data_client.client.table("predictions").insert({
        "plant_id": plant_uuid,
        "next_watering_at": next_watering_at,
        "recommended_water_ml": int(result["recommended_ml"]),
        "confidence": confidence_map.get(result["confidence"], 0.5),
        "model": "lightgbm_ensemble_v1",
        "details": {k: v for k, v in result.items() if k not in ("plant_id", "timestamp")},
    }).execute()
```

---

## ПІДСУМКОВА ХРОНОЛОГІЯ

| # | Крок | Що робимо | Де код |
|---|------|-----------|--------|
| 1 | Очистка ML | Видалити зайве, оновити .gitignore | `services/moonplants_ml/` |
| 2 | Скелет API | mkdir, requirements.txt, railway.json, копія pkl | `services/moonplants_api/` |
| 3 | Schemas+Config | Pydantic схеми, урізаний config | `app/schemas.py`, `app/config.py` |
| 4 | Data Client | Supabase fetch + нормалізація схем | `app/data_client.py` |
| 5 | Features | Копія engineering.py з виправленим import | `app/features.py` |
| 6 | Predictor | Завантаження pkl + inference логіка | `app/predictor.py` |
| 7 | FastAPI | main.py з endpoints + auth | `app/main.py` |
| 8 | Railway | Deploy через GitHub, ENV vars | Railway Dashboard |
| 9 | Next.js | Route handler + Vercel ENV | `apps/web/app/api/v1/plants/[id]/prediction/` |
