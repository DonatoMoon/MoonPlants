# MoonPlants ML — Повний технічний опис системи
> Референс для розробки API та веб-частини. Версія: 2026-02-24.

---

## 1. Загальна архітектура

```
┌──────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│  readings_10min.csv          watering_events.csv                 │
│  (sensor readings, NO        (окрема таблиця поливів)            │
│   watering columns)                                              │
│  plant_instances.csv         species.csv                         │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│               FEATURE ENGINEERING  (57 features)                 │
│  lag moisture × 8 | rolling mean/std/min × 9 | VPD | calendar   │
│  steps_since_last_watering | pot/species metadata                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌───────────────┐ ┌──────────┐ ┌────────────┐
     │TrajectoryModel│ │TTE Model │ │AmountModel │
     │  (Approach A) │ │(Approach │ │            │
     │  MAE=0.039    │ │    B)    │ │  MAE=104ml │
     │  RMSE=0.068   │ │MAE=5.9h  │ │  MAPE=6.8% │
     └───────┬───────┘ └────┬─────┘ └─────┬──────┘
             └──────────────┼─────────────┘
                            ▼
             ┌──────────────────────────┐
             │   Per-plant calibration  │
             │   (additive bias per ID) │
             └──────────────┬───────────┘
                            ▼
          predict_watering_plan(plant_instance_id, now_ts)
          → { time_to_water_hours, recommended_ml,
              confidence, rationale, ... }
```

---

## 2. Схема даних (таблиці)

### 2.1 `readings_10min.csv` — сенсорні вимірювання

| Колонка | Тип | Діапазон | Опис |
|---|---|---|---|
| `timestamp_utc` | ISO8601 UTC | 2026-02-01…2026-07-31 | Кожні 10 хв |
| `device_id` | string | dev_1301…dev_1309 | ID сенсора |
| `plant_instance_id` | int | 1–9 | ID екземпляра рослини |
| `species_id` | int | 728, 1220, 2961 | ID виду |
| `soil_moisture` | float | **0.165 – 0.822** | Нормалізована вологість (0=сухо, 1=насичено) |
| `soil_moisture_raw` | int | 280–860 | Сирий ADC сигнал сенсора |
| `soil_temperature_c` | float | 18–30 °C | Температура ґрунту |
| `air_temperature_c` | float | 17–32 °C | Температура повітря |
| `air_humidity_pct` | float | 20–90 % | Відносна вологість повітря |
| `light_lux` | float | 0–7000 lux | Освітленість |

> ⚠️ **`is_watering_event` і `watering_amount_ml` ВІДСУТНІ в readings.**
> Поливи зберігаються виключно в `watering_events.csv`.

**Обсяг:** 234,576 рядків = 9 рослин × 26,064 кроків (180 днів × 144/день)

---

### 2.2 `watering_events.csv` — події поливу

| Колонка | Тип | Діапазон | Опис |
|---|---|---|---|
| `event_id` | int | 1–383 | PK |
| `timestamp_utc` | ISO8601 UTC | Feb–Jul 2026 | Момент поливу |
| `plant_instance_id` | int | 1–9 | Яку рослину полили |
| `species_id` | int | 728/1220/2961 | Вид |
| `reason` | string | `scheduled` / `below_threshold` | Причина поливу |
| `amount_ml` | float | **5 – 5000 ml** | Скільки мл вилито |
| `moisture_before` | float | 0.17–0.65 | Вологість ДО поливу |
| `moisture_after` | float | 0.50–0.82 | Вологість ПІСЛЯ поливу |
| `target_moisture` | float | 0.60 / 0.62 / 0.72 | Цільова вологість (per species) |
| `runoff_fraction` | float | 0.0–0.8 | Частка води що стекла |

**Обсяг:** 383 події. Per plant: 21–94 подій за 6 місяців.

---

### 2.3 `plant_instances.csv` — метадані рослин

| Колонка | Опис | Приклад значень |
|---|---|---|
| `plant_instance_id` | PK | 1–9 |
| `species_id` | FK → species | 728, 2961, 1220 |
| `pot_volume_ml` | Об'єм горщика | 856–6364 ml |
| `soil_retention_factor` | Здатність ґрунту тримати воду | 0.80–1.12 |
| `drainage_factor` | Частка води, що поглинається | 0.55–0.76 |
| `orientation` | Розміщення відносно вікна | west/east/north_window |
| `sensor_dry_raw` | ADC при сухому ґрунті | 277–344 |
| `sensor_wet_raw` | ADC при насиченому ґрунті | 784–850 |
| `baseline_air_temp_c` | Базова кімнатна температура | 19.2–23.5 °C |
| `baseline_air_humidity_pct` | Базова вологість кімнати | 31.4–61.1 % |

---

### 2.4 `species.csv` — довідник видів

| species_id | Назва | watering | benchmark_days | drought_tolerant |
|---|---|---|---|---|
| 728 | Aloe vera | Minimum | 7–10 | True |
| 2961 | Ficus elastica | Average | 7–10 | True |
| 1220 | Begonia | Frequent | 3–4 | False |

---

## 3. Feature Engineering — 57 ознак

### 3.1 Лагові ознаки (no-leakage)
```
moisture_lag_1      — вологість 10 хв тому
moisture_lag_3      — 30 хв тому
moisture_lag_6      — 1h тому
moisture_lag_12     — 2h тому
moisture_lag_18     — 3h тому
moisture_lag_36     — 6h тому
moisture_lag_72     — 12h тому
moisture_lag_144    — 24h тому
moisture_delta_1step — швидкість висихання: lag1 - lag2
```
**Anti-leakage:** всі rolling на `sm.shift(1)` — поточний крок виключений.

### 3.2 Rolling статистики (вікна: 60 / 360 / 1440 хвилин)
```
moisture_roll_mean_{w}   — середня вологість за вікно
moisture_roll_std_{w}    — варіативність (нестабільність сенсора)
moisture_roll_min_{w}    — мінімум (найгірший момент у вікні)
```

### 3.3 Середовищні ознаки
```
vpd_kpa              — Vapour Pressure Deficit (kPa)
                       SVP = 0.6108 × exp(17.27T/(T+237.3))
                       VPD = SVP × (1 - RH/100)
                       Фізичний драйвер транспірації рослин
vpd_roll_mean_60min  — середній VPD за 1h
vpd_roll_mean_360min — середній VPD за 6h
light_norm           — освітленість 0–1 (відносно макс. в датасеті)
heat_load_proxy      — air_temp × light_norm
```

### 3.4 Календарні ознаки
```
hour_sin / hour_cos  — циклічне кодування години (0–24 → sin/cos)
dow_sin / dow_cos    — циклічне кодування дня тижня
is_daylight          — 1 якщо 6:00–20:00 UTC
day_of_month         — 1–31
```

### 3.5 Ознаки часу від останнього поливу
```
steps_since_last_watering  — кількість 10-хв кроків (з watering_events)
hours_since_last_watering  — те саме в годинах (0–220h)
```
> Обчислюються через `searchsorted` по `watering_events.timestamp_utc`.
> **Не з readings** — джерело виключно `watering_events.csv`.

### 3.6 Фізичні параметри рослини/горщика
```
pot_volume_ml, soil_retention_factor, drainage_factor
sensor_dry_raw, sensor_wet_raw
baseline_air_temp_c, baseline_air_humidity_pct
watering_benchmark_days_min, watering_benchmark_days_max
watering_category_num   — Minimum=1, Average=2, Frequent=3
drought_tolerant_flag   — 0/1
species_watering_benchmark_days_mid
```

---

## 4. Три ML-моделі

### 4.1 TrajectoryModel (ОСНОВНА)

**Тип задачі:** Regression (LightGBM GBDT)

**Що передбачає:**
```
Input:  feature_row[t]  (57 ознак)
Output: soil_moisture[t + 432 steps]  ←  432 × 10min = 72 годин вперед
```

**Навчання:**
- Target: `moisture_at_horizon` = `soil_moisture.shift(-432)` per plant
- 164,203 навчальних прикладів (train, Feb 1 – Jun 7)
- 84 дерева (LightGBM early stopping)

**Метрики (test: Jul 4–31):**
```
MAE  = 0.039 moisture units  (~8.6% від mean=0.452)
RMSE = 0.068 moisture units
```

**Конвертація в "коли полити" (лінійна інтерполяція):**
```
current = 0.55,  predicted_72h = 0.27,  threshold = 0.22
slope = (0.27 - 0.55) / 72 = -0.00389/h
hours = (0.22 - 0.55) / (-0.00389) ≈ 84.8h  ← "поливати через ~85h"

Якщо predicted_72h > threshold → trajectory_hours = None
(не перетинає поріг у горизонті)
```

**Топ-3 ознаки (feature importance, gain):**
1. `soil_moisture` — поточна вологість
2. `watering_benchmark_days_min/max` — видовий prior
3. `hours_since_last_watering` — час від поливу

---

### 4.2 TimeToEventModel (ПІДТВЕРДЖЕННЯ)

**Тип задачі:** Regression (LightGBM GBDT)

**Що передбачає:**
```
Input:  feature_row[t]
Output: hours_to_next_watering  (0 – 222 год)
```

**Target distribution у датасеті:**
```
mean   = 68.8h  (~2.9 дні)
median = 52.2h  (~2.2 дні)
std    = 53.8h
min    = 0.2h | max = 222h
p10 = 10.2h | p50 = 52.2h | p90 = 153.0h
```

**Метрики (test):**
```
MAE         = 5.94 годин
MAPE        = 20%
hit_rate±12h = 85.8%  ← 86% прогнозів у вікні ±12h від факту
```

**494 дерева** (складніша задача — регресія з широким розподілом).

---

### 4.3 AmountModel

**Тип задачі:** Regression (LightGBM, objective=MAE/L1)

**Що передбачає:**
```
Input:  snapshot @ момент поливу
        + delta_moisture_target = target_moisture - moisture_before
Output: amount_ml  (5 – 5000 ml)
```

**Тренується на 383 точках** (not readings, а watering events snapshots).

**Метрики (test, 62 події):**
```
MAE  = 103.8 ml
RMSE = 143.6 ml
MAPE = 6.8%    ← відносна похибка прийнятна
```

**Fallback (фізична формула):**
```
absorbed = pot_volume_ml × (target - current) × soil_retention_factor
total    = absorbed / drainage_factor
```

---

## 5. Per-plant Calibration

**Механізм:** additive bias correction на validation set.
```python
bias[plant_id] = mean(y_true_val[plant] - y_pred_val[plant])
predict_calibrated = predict_global(X) + bias[plant_id]
```

**TTE biases (годин):**
```
Plant 1 (aloe small):    +4.13h
Plant 2 (aloe medium):   -3.14h
Plant 4 (ficus small):   -4.56h
Plant 5 (ficus medium):  -5.99h
Plant 7 (begonia small): -0.52h  ← найточніша
```

**Ефект:** TTE MAE 6.11h → **5.21h** (-14.7%)

**Amount biases (ml):**
```
Plant 1: -46ml | Plant 3: +76ml | Plant 9: +78ml
```

---

## 6. predict_watering_plan() — повний опис

### Виклик
```python
from pipelines.predict import predict_watering_plan
result = predict_watering_plan(plant_instance_id=4, now_ts=None)
```

### Повернений JSON
```json
{
  "plant_instance_id": 4,
  "timestamp": "2026-07-15T10:00:00+00:00",
  "current_moisture": 0.421,
  "time_to_water_hours": 31.5,
  "recommended_ml": 285.0,
  "confidence": "high" | "medium" | "low",
  "rationale": "Current moisture: 0.421 | ...",
  "trajectory_pred_moisture_at_horizon": 0.218,
  "trajectory_hours": 38.7,
  "tte_pred_hours": 24.3,
  "low_threshold": 0.28,
  "high_target": 0.65
}
```

### Ensemble логіка
```
IF trajectory_hours is not None:
    ensemble = 0.7 × trajectory_hours + 0.3 × tte_hours
    confidence = "high"   if |traj - tte| < 12h
               = "medium" if |traj - tte| >= 12h
ELSE:
    ensemble = tte_hours
    confidence = "low"

ensemble = max(0.0, ensemble)
```

### Пороги (low_threshold / high_target) з species
```
Minimum  (Aloe):    low=0.20, high=0.55
Average  (Ficus):   low=0.25, high=0.65
Frequent (Begonia): low=0.35, high=0.70

recommended_ml = AmountModel.recommend_amount(
    snapshot, target=(low+high)/2, plant_instance_id
)
```

---

## 7. Реалістичні діапазони для API/UI

### `soil_moisture` — стани рослини
| Значення | Стан | Рекомендація |
|---|---|---|
| 0.70–0.82 | Щойно полито | Нічого |
| 0.50–0.70 | Оптимально | Нічого |
| 0.25–0.50 | Підсихає | Моніторинг |
| 0.17–0.25 | Критично сухо | **Полити зараз** |
| < 0.17 | Стрес | Терміново |

### `time_to_water_hours` — типові значення по виду
| Вид | Типовий діапазон | Примітка |
|---|---|---|
| Begonia (1220) | 12–80h | ~3-4 дні між поливами |
| Ficus (2961) | 80–180h | ~5-8 днів |
| Aloe (728) | 100–220h | ~7-9 днів |

### `recommended_ml` — типові діапазони
| Горщик (pot_volume_ml) | Вид | Діапазон |
|---|---|---|
| Малий (~856ml) | Ficus | 100–300 ml |
| Середній (~2755ml) | Ficus | 400–1000 ml |
| Малий (~1117ml) | Begonia | 200–500 ml |
| Великий (~6339ml) | Begonia | 2000–4500 ml |
| Великий (~6364ml) | Aloe | 500–2000 ml |

### `confidence` — значення для UI
| Значення | Смисл | Рекомендація для UI |
|---|---|---|
| `"high"` | Обидві моделі погоджуються (<12h різниця) | Точний час, без діапазону |
| `"medium"` | Розходяться >12h | Показати ±12h діапазон |
| `"low"` | Тільки TTE (trajectory не перетинає поріг) | "Приблизно через X год" |

---

## 8. Збережені артефакти

```
artifacts/
  models/
    trajectory_model.pkl    — TrajectoryModel (84 дерева + biases)
    tte_model.pkl            — TimeToEventModel (494 дерева + biases)
    amount_model.pkl         — AmountModel (94 дерева + biases)
  metrics/
    train_metrics.json       — всі метрики
  features_cache.parquet     — 234,576 × 59 колонок
```

**Завантаження моделі:**
```python
import pickle
with open("artifacts/models/trajectory_model.pkl", "rb") as f:
    model = pickle.load(f)
```

---

## 9. Обмеження і roadmap

| # | Обмеження | Вплив | Пріоритет |
|---|---|---|---|
| 1 | `trajectory_hours=None` у 14% → `confidence=low` | UI показує low занадто часто | P1: multi-horizon (12/24/48/72h) |
| 2 | Inference читає весь CSV | Повільно для API (>1s) | P1: feature store / БД snapshot |
| 3 | Тільки 3 види | Zero-shot для нових видів | P2: більше видів у species.csv |
| 4 | Pickle серіалізація | Несумісність Python версій | P2: ONNX або joblib |
| 5 | Статичний калібрування | Не оновлюється online | P2: incremental calibration |

---

## 10. Для API агента: мінімальний контракт

### Що потрібно від API для inference
```
Вхід:  plant_instance_id (int), timestamp (datetime UTC, optional)
Вихід: JSON об'єкт (розділ 6)
```

### Що потрібно від БД для inference
- Останні **200+ readings** для plant_instance_id (для rolling 1440min)
- Останні **50 watering events** для plant_instance_id (для steps_since)
- Рядок з `plant_instances` для plant_instance_id
- Рядок з `species` для species_id

### Мінімальний Python виклик
```python
import sys
sys.path.insert(0, "path/to/src")
from pipelines.predict import predict_watering_plan

result = predict_watering_plan(
    plant_instance_id=4,
    now_ts=None   # або datetime з timezone.utc
)
# result: dict з полями описаними в розділі 6
```

