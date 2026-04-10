# 📡 MoonPlants IoT API — Документація v2

## Огляд архітектури

```
┌─────────────┐           ┌──────────────────┐           ┌─────────────┐
│   ESP32     │──HMAC───→ │   Next.js API    │ ←─Auth──→ │  Web User   │
│  + Sensors  │   HTTP    │  /api/iot/v1/*   │  Supabase │  /api/v1/*  │
│  + Pump     │           │  /api/v1/*       │  JWT      │             │
│  + Lamp     │           └────────┬─────────┘           └─────────────┘
└─────────────┘                    │
                             ┌─────┴─────┐
                             │  Supabase  │
                             │ PostgreSQL │
                             │ + Storage  │
                             └───────────┘
```

---

## 1. Таблиці бази даних

| Таблиця | Призначення |
|---------|------------|
| `devices` | ESP32 контролери (claim/unclaim, channels, firmware) |
| `device_credentials` | HMAC секрети (тільки service role) |
| `species_cache` | Кеш видів Perenual (з фото в Storage) |
| `plants` | Рослини юзера → прив'язка до device + channel |
| `measurements` | Виміри з датчиків (plant_id + seq idempotency) |
| `watering_events` | Факти поливу (manual / auto / command) |
| `predictions` | Прогнози поливу (rulebased_v1) |
| `device_commands` | Черга команд (PUMP_WATER / LIGHT_ON / LIGHT_OFF / SET_CONFIG) |

**Ключові зв'язки:**
- `devices.id` → `plants.device_id` (1 device → N plants)
- `plants.soil_channel` — номер каналу (UNIQUE per device)
- `measurements.plant_id` — сервер мапить `channel → plant_id` при інжесті
- `device_commands.device_id` — команди прив'язані до девайса

---

## 2. Device Authentication (HMAC-SHA256)

### Обов'язкові заголовки

```
X-Device-Id:         <uuid>
X-Device-Seq:        <uint64>    монотонний лічильник (зберігати у flash)
X-Device-Timestamp:  <unix_sec>  допуск ±120 сек
X-Content-SHA256:    <hex>       sha256(body), для GET — sha256("")
X-Device-Signature:  <base64url> hmac_sha256(secret, canonical_string)
```

### Canonical string

```
<METHOD>\n<PATH>\n<X-Device-Id>\n<X-Device-Seq>\n<X-Device-Timestamp>\n<X-Content-SHA256>
```

### Перевірки на сервері
1. Всі headers присутні
2. Timestamp в межах ±120с
3. SHA256(body) == X-Content-SHA256
4. Device існує і status = "claimed"
5. seq > devices.last_seq (anti-replay)
6. HMAC підпис валідний (timing-safe)
7. Оновити last_seq, last_seen_at

---

## 3. IoT API Endpoints

### `POST /api/iot/v1/measurements`
**Auth:** HMAC headers

**Body:**
```json
{
  "measuredAt": 1760000000,
  "air": { "tempC": 23.4, "humidityPct": 48.2 },
  "lightLux": 1200,
  "soil": [
    { "channel": 1, "moistureRaw": 1830 },
    { "channel": 2, "moistureRaw": 2100 },
    { "channel": 3, "moistureRaw": 1600 },
    { "channel": 4, "moistureRaw": 9999 }
  ],
  "batteryV": 4.05,
  "rssiDbm": -61
}
```

**Response:**
```json
{ "ok": true, "ingested": 3, "ignoredChannels": [4] }
```

**Логіка:** Для кожного `soil[channel]` сервер шукає `plants` де `device_id + soil_channel` збігаються. Якщо рослина не прив'язана — канал ігнорується.

**Idempotency:** `(device_id, seq, plant_id)` unique constraint — повтор того ж seq не створює дублів.

---

### `GET /api/iot/v1/commands?limit=10`
**Auth:** HMAC headers

**Response:**
```json
{
  "commands": [
    {
      "id": "uuid-cmd-1",
      "type": "PUMP_WATER",
      "payload": { "channel": 2, "water_ml": 120, "max_duration_sec": 20 }
    },
    {
      "id": "uuid-cmd-2",
      "type": "LIGHT_ON",
      "payload": { "duration_sec": 3600 }
    }
  ]
}
```

**Логіка:**
1. Expire просрочені команди
2. Повернути `queued` команди де `send_after <= now() && expires_at > now()`
3. Позначити повернуті як `status = "sent"`

---

### `POST /api/iot/v1/commands/:commandId/ack`
**Auth:** HMAC headers

**Body:**
```json
{
  "status": "ok",
  "executedAt": 1760000300,
  "result": { "durationSec": 18 }
}
```

**Response:** `{ "ok": true }`

**Логіка:**
- `status: "ok"` → command `acked`, якщо PUMP_WATER — записує `watering_event`
- `status: "failed"` → command `failed`
- Ідемпотентний: повторний ACK → `{ "ok": true, "alreadyAcked": true }`

---

### `GET /api/iot/v1/device-config`
**Auth:** HMAC headers

**Response:**
```json
{
  "claimed": true,
  "deviceId": "uuid",
  "displayName": "Kitchen Controller",
  "channelsCount": 4,
  "supportsPumps": true,
  "supportsLight": true,
  "firmwareVersion": "1.0.0",
  "channels": [
    { "channel": 1, "plantId": "uuid", "plantName": "Фікус", "autoWatering": true, "autoLight": false },
    { "channel": 2, "plantId": "uuid", "plantName": "Кактус", "autoWatering": false, "autoLight": false }
  ],
  "config": {
    "measurementIntervalSec": 300,
    "commandPollIntervalSec": 60
  }
}
```

---

## 4. User API Endpoints

### Devices
| Method | Path | Опис |
|--------|------|------|
| `GET` | `/api/v1/devices` | Список девайсів юзера |
| `GET` | `/api/v1/devices/:id` | Деталі + рослини + pending commands |
| `POST` | `/api/v1/devices/claim` | Прив'язати девайс: `{ deviceId, claimCode }` |
| `POST` | `/api/v1/devices/:id/actions/light` | Лампа: `{ mode: "on"|"off"|"on_for", durationSec? }` |

### Plants
| Method | Path | Опис |
|--------|------|------|
| `POST` | `/api/v1/plants` | Створити рослину: `{ deviceId?, soilChannel?, name, speciesName, perenualId?, ... }` |
| `GET` | `/api/v1/plants/:id` | Деталі + species + last measurement + prediction |
| `DELETE` | `/api/v1/plants/:id` | Видалити (CASCADE: measurements, predictions, events) |
| `GET` | `/api/v1/plants/:id/measurements?from=&to=&limit=` | Графіки |
| `POST` | `/api/v1/plants/:id/watering-events` | Ручний полив: `{ waterMl?, happenedAt?, note? }` |
| `POST` | `/api/v1/plants/:id/actions/water-now` | Команда поливу: `{ waterMl }` (з double-check) |
| `GET` | `/api/v1/plants/:id/predictions` | Прогноз наступного поливу |

---

## 5. Claim / Pairing Flow

### На виробництві:
1. Генерувати для кожного ESP: `device_id` (UUID), `claim_code` (24+ chars), `hmac_secret` (32 bytes)
2. В БД: `devices.claim_code_hash = sha256(claim_code)`, `device_credentials.hmac_secret = hmac_secret`
3. На коробці/QR: `device_id + claim_code`

### Юзер:
1. UI: "Підключити контролер" → сканує QR або вводить `device_id` + `claim_code`
2. `POST /api/v1/devices/claim { deviceId, claimCode }`
3. Сервер: перевіряє hash, ставить `status=claimed`, `owner_user_id=auth.uid()`
4. Захист: max 5 спроб → cooldown 60 хв

---

## 6. Command Queue + Double-Check

### Полив:
1. Юзер натискає "Полити" → `POST /api/v1/plants/:id/actions/water-now { waterMl: 150 }`
2. Сервер **перевіряє** (double-check):
   - Чи був полив за останні 12 годин?
   - Чи вологість ґрунту > 60%?
3. Якщо ОК → створює `device_commands` з `status=queued`
4. ESP робить `GET /api/iot/v1/commands` → отримує команду
5. ESP виконує полив → `POST /api/iot/v1/commands/:id/ack { status: "ok" }`
6. Сервер записує `watering_event` + оновлює `plants.last_watered_at`

### Лампа:
- Конфлікт-захист: якщо є активна light команда → 409
- Команди: `LIGHT_ON { duration_sec? }`, `LIGHT_OFF {}`

---

## 7. Prediction Engine (rulebased_v1)

**Алгоритм:**
1. Останні 50 вимірів → тренд висихання (%/годину)
2. Поріг на основі виду рослини: Frequent=40%, Average=30%, Minimum=20%
3. Корекція на температуру (>28°C → ×0.7, <15°C → ×1.3)
4. Об'єм води = 20% від pot_volume_ml (або розрахунок з діаметра/висоти)
5. Confidence: 0.5 базова + бонуси за кількість даних

**Endpoint:** `GET /api/v1/plants/:id/predictions`

---

## 8. Файлова структура нового коду

```
lib/
├── supabase/
│   ├── admin.ts          — Service-role Supabase client
│   └── database.types.ts — TypeScript типи для всіх таблиць
├── iot/
│   ├── auth.ts           — HMAC device authentication
│   └── schemas.ts        — Zod schemas для всіх API
├── auth/
│   └── getUser.ts        — Helper для Supabase Auth
├── species/
│   └── cache.ts          — Perenual → Supabase Storage кеш
└── predictions/
    └── rule-based.ts     — Rule-based prediction + double-check

app/api/
├── iot/v1/
│   ├── measurements/route.ts       — POST: прийом даних з ESP
│   ├── commands/route.ts           — GET: pending commands для ESP
│   ├── commands/[commandId]/ack/route.ts  — POST: ACK від ESP
│   └── device-config/route.ts      — GET: конфіг для ESP
└── v1/
    ├── devices/
    │   ├── route.ts                — GET: список девайсів
    │   ├── claim/route.ts          — POST: прив'язка девайса
    │   └── [deviceId]/
    │       ├── route.ts            — GET: деталі девайса
    │       └── actions/light/route.ts  — POST: керування лампою
    └── plants/
        ├── route.ts                — POST: створити рослину
        └── [plantId]/
            ├── route.ts            — GET/DELETE: деталі/видалення
            ├── measurements/route.ts   — GET: виміри для графіків
            ├── watering-events/route.ts — POST: ручний полив
            ├── predictions/route.ts    — GET: прогноз
            └── actions/water-now/route.ts — POST: команда поливу

database/
└── migration_iot_v2.sql   — Повна SQL міграція
```

---

## 9. Env Variables

```env
# Вже існували:
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
PERENUAL_API_KEY=...

# НОВИЙ — обов'язковий:
SUPABASE_SERVICE_ROLE_KEY=...   # Supabase Dashboard → Settings → API → service_role
```

---

## 10. Як запустити міграцію

1. Відкрити Supabase Dashboard → SQL Editor
2. Виконати `database/migration_iot_v2.sql`
3. Додати `SUPABASE_SERVICE_ROLE_KEY` в `.env.local`
4. Створити Storage bucket `plants` (якщо не існує) з публічним доступом

