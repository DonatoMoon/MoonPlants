# MoonPlants — повний технічний аудит проєкту (стан репозиторію)

> **Мета документа:** дати максимально повну картину поточного стану проєкту: архітектура, маршрути, потік даних, безпека, IoT-інтеграція, що вже реалізовано та що ще потрібно довести до продакшн-рівня.

---

## 1) Що це за проєкт

MoonPlants — Next.js (App Router) вебплатформа для моніторингу та догляду за кімнатними рослинами з інтеграцією IoT-контролера (ESP32), Supabase (PostgreSQL + Auth + Storage), кешуванням довідника рослин через Perenual API та MVP-модулем прогнозування поливу.

### Поточна цільова архітектура
- **Web/UI + User API**: `/api/v1/*` (JWT через Supabase session)
- **IoT API**: `/api/iot/v1/*` (HMAC-SHA256 заголовки)
- **DB**: Supabase Postgres (таблиці devices, plants, measurements, commands, predictions тощо)
- **External**: Perenual API для довідника видів

---

## 2) Технологічний стек

## Frontend
- Next.js 15 (App Router), React 19
- TailwindCSS 4 + Radix UI
- Recharts для графіків

## Backend
- Next.js Route Handlers (`app/api/**/route.ts`)
- Server Actions для auth та частини UI-операцій
- Zod для валідації payload

## Дані/інфраструктура
- Supabase Auth (користувачі)
- Supabase Postgres (основна доменна модель)
- Supabase Storage bucket `plants` (фото рослин/видів)

## Документація/інтеграції
- OpenAPI генерація (`/api/openapi.json`, `public/openapi.json`)
- Swagger UI (`/api-docs`)
- Postman collection/env в `postman/`

---

## 3) Структура репозиторію (логічно)

- `app/` — сторінки, layout, API route handlers, server actions.
- `components/` — UI компоненти (landing, auth, profile, charts, forms).
- `lib/` — інфраструктурні та доменні модулі:
  - `lib/iot/*` — HMAC auth + Zod схеми IoT/User API
  - `lib/predictions/rule-based.ts` — MVP прогноз + double-check
  - `lib/species/cache.ts` — інтеграція та кеш Perenual
  - `lib/supabase/*` — клієнти Supabase (anon/server/admin)
  - `lib/openapi/*` — source-of-truth OpenAPI
- `supabase/migrations/` — міграції БД (актуальний шлях керування схемою)
- `database/` — SQL-файли (історичні/додаткові схеми)
- `postman/` — колекції для ручного тестування API

---

## 4) Доменно-дана модель (БД)

Актуальна міграційна модель (v2) включає:

1. **devices**
   - фізичний контролер
   - status: `unclaimed|claimed|revoked`
   - owner, claim security, anti-replay (`last_seq`), capabilities (`supports_pumps/light`)

2. **device_credentials**
   - HMAC secret для девайса (service-role only)

3. **species_cache**
   - кеш видів/метаданих з Perenual, включно з `default_image_url`

4. **plants**
   - рослина юзера
   - прив’язка до `device_id` + `soil_channel`
   - унікальність: один канал = одна рослина на пристрої

5. **measurements**
   - телеметрія, прив’язана до `plant_id` + `device_id`
   - є `seq` для ідемпотентності
   - unique `(device_id, seq, plant_id)`

6. **watering_events**
   - факти поливу (manual/auto/command)

7. **predictions**
   - прогнози поливу (model=`rulebased_v1`)

8. **device_commands**
   - черга команд на ESP32 (PUMP_WATER, LIGHT_ON/OFF, SET_CONFIG)
   - lifecycle status + ACK flow + idempotency key

### Важливі бізнес-інваріанти, які вже в схемі
- Один `soil_channel` не може бути використаний двома рослинами на одному device.
- Видалення plant каскадно видаляє measurements/predictions/watering_events.
- Є RLS політики для user-space таблиць.

---

## 5) Усі наявні маршрути (routes)

## Web сторінки
- `GET /` — лендінг (Hero/About/FAQ/Feedback).
- `GET /profile` — профіль користувача + список рослин + останні виміри.
- `GET /profile/[id]` — сторінка конкретної рослини + графіки + видалення.
- `GET /plant-species/[slug]` — детальна сторінка виду (запит напряму до Perenual).
- `GET /api-docs` — Swagger UI сторінка.

## Utility API
- `GET /api/openapi.json` — OpenAPI JSON.
- `GET /api/perenual-autocomplete?q=` — автокомпліт видів із Perenual.

## User API (`/api/v1/*`, потрібна user session)

### Devices
- `GET /api/v1/devices`
  - список claimed-девайсів користувача.
- `GET /api/v1/devices/:deviceId`
  - деталі девайса, рослини, pending commands.
- `POST /api/v1/devices/claim`
  - прив’язка за `deviceId + claimCode`.
  - з rate-limit (max 5 спроб, cooldown 60 хв).
- `POST /api/v1/devices/:deviceId/actions/light`
  - light command (`on|off|on_for`), конфлікт-контроль активних light-команд.

### Plants
- `POST /api/v1/plants`
  - створення рослини (опц. `deviceId`, `soilChannel`).
  - перевірка володіння device, унікальності channel.
  - кешування species через Perenual.
- `GET /api/v1/plants/:plantId`
  - деталі рослини + останній вимір + останній прогноз.
- `DELETE /api/v1/plants/:plantId`
  - видалення рослини (каскад чистить історію).
- `GET /api/v1/plants/:plantId/measurements?from=&to=&limit=`
  - історичні виміри для графіків.
- `POST /api/v1/plants/:plantId/watering-events`
  - ручний запис факту поливу.
- `GET /api/v1/plants/:plantId/predictions`
  - обчислення rule-based прогнозу + запис у БД.
- `POST /api/v1/plants/:plantId/actions/water-now`
  - створення команди поливу після double-check.

## IoT API (`/api/iot/v1/*`, HMAC)
- `POST /api/iot/v1/measurements`
  - ingest телеметрії (fan-out channel -> plant), ignore незамаплені канали.
- `GET /api/iot/v1/commands?limit=`
  - видача queued команд, маркування sent, expire за TTL.
- `POST /api/iot/v1/commands/:commandId/ack`
  - ACK/failed, при успішному PUMP_WATER створює watering_event.
- `GET /api/iot/v1/device-config`
  - конфіг для девайса (claimed state, mapping channel->plant, intervals).

---

## 6) Потік даних системи (as-is)

### 6.1 Реєстрація/логін
- Реалізовано через server actions (`signUp`, `signIn`, `signOut`) та Supabase Auth.
- UI-діалоги в `components/auth/*`.

### 6.2 Claim контролера
1. Користувач надсилає `deviceId + claimCode`.
2. Backend перевіряє статус девайса, cooldown/attempts.
3. Порівнює SHA256(claimCode) з `devices.claim_code_hash`.
4. Якщо валідно — ставить owner + status=claimed.

### 6.3 Прив’язка рослин до каналів
- При створенні plant (API) можна вказати `deviceId + soilChannel`.
- Backend перевіряє, що канал не зайнятий.
- Це фізично відповідає «сенсор 1..N = конкретна рослина».

### 6.4 Ingest телеметрії
1. Девайс підписує payload HMAC.
2. Backend верифікує заголовки, timestamp, hash, signature, anti-replay seq.
3. По кожному `soil.channel` шукає відповідний plant.
4. Створює measurements по mapped каналах.
5. Unmapped канали повертає в `ignoredChannels`.

### 6.5 Команди (лампа/помпа)
- User API ставить команду в `device_commands` (queued).
- Девайс періодично poll-ить `/commands`, отримує queued.
- Після виконання шле `ack`.
- Для PUMP_WATER при ok створюється `watering_event` + оновлюється `last_watered_at`.

### 6.6 Прогноз
- `GET /predictions` запускає `predictNextWatering()`:
  - бере останні виміри,
  - оцінює тренд висихання,
  - застосовує пороги/температурну корекцію,
  - рахує рекомендований об’єм,
  - пише запис у `predictions`.

### 6.7 Double-check перед поливом
- Перед `water-now` викликається `doubleCheckBeforeWatering()`:
  - якщо був недавній полив (12 год) — блок
  - якщо вологість >60% — блок
  - інакше створюється команда поливу.

---

## 7) Що вже реалізовано добре

1. **Базовий secure IoT контур**:
   - HMAC auth + canonical string,
   - content hash,
   - timestamp tolerance,
   - anti-replay seq,
   - signature timing-safe compare.

2. **Модель multi-channel для одного ESP32**:
   - `plants.device_id + soil_channel` та unique index.

3. **Безпечний claim flow з захистом від brute force**:
   - hash claim-code,
   - ліміти помилок і cooldown.

4. **Командна шина з ACK та статусами**:
   - queued -> sent -> acked/failed/expired.

5. **Кешування довідника рослин**:
   - species_cache + опціональне кешування фото в Supabase Storage.

6. **MVP прогноз + double-check**:
   - відповідає етапу MVP до інтеграції full ML.

7. **OpenAPI/Swagger/Postman**:
   - API документоване і експортується.

8. **Каскадне очищення історії при видаленні рослини**:
   - важливо для «чистого» перевикористання каналу.

---

## 8) Виявлені прогалини / ризики / що ще не завершено

## A. Невідповідності між UI та API
1. **UI додавання рослини (Server Action)** наразі **не прив’язує device/channel**.
   - API `/api/v1/plants` це підтримує, але форма профілю працює через `app/actions/plants/addPlant.ts` і не має полів device/channel.
2. **Фото користувача**:
   - в Server Action є upload,
   - в API `/api/v1/plants` зараз upload не реалізований (бере cached image з species).
   - Тобто вимога «якщо користувач не дав фото — взяти дефолтне» виконана частково в різних потоках, але не уніфіковано одним endpoint.

## B. Безпека/надійність
3. **Anti-replay race condition**: перевірка `seq > last_seq` і update `last_seq` не в транзакції/lock-режимі.
   - При конкурентних запитах теоретично можливі гонки.
4. **Немає rotation lifecycle для HMAC secret** (table підтримує `secret_version`, але немає endpoint/workflow).
5. **Немає device provisioning API** для «виробництва» (генерація device, claim code, secret, друк QR).

## C. Прогноз/автоматизація
6. Прогноз обчислюється **on-demand** при `GET /predictions`; немає scheduler/job системи.
7. Немає окремого сервісу прогнозування (поки MVP локально в monolith).
8. Немає повного flow «запланували полив -> перевірили перед execute -> автоматично відмінили/перенесли», крім ручного `water-now` double-check.

## D. IoT емуляція та інтеграційне тестування
9. Немає окремого симулятора ESP32 у репо (скрипта/сервісу), хоча API готове для симуляції.
10. Немає end-to-end сценарію тесту «claim -> ingest -> predict -> command -> ack» як автоматичного CI тесту.

## E. User-facing функціонал
11. Немає UI для:
   - claim пристрою,
   - вибору каналу при додаванні рослини,
   - керування лампою,
   - ручного запуску `water-now` з об’ємом,
   - перегляду черги команд / статусів ACK.
12. В `app/profile/[id]` plant читається без фільтрації за owner_user_id (ризик перегляду чужої рослини за id).

## F. Архітектурні дрібні борги
13. Існує старий `database/schema.sql`, який не є джерелом істини для поточної v2 моделі — потенційна плутанина.
14. `commandAckPayloadSchema` підтримує `partial`, але ACK handler трактує все крім `ok` як failed (потрібна чітка бізнес-логіка partial).

---

## 9) Як система **має працювати** (цільова схема, узгоджена з вашим контекстом)

Нижче — рекомендована виробнича логіка, щоб закрити вимоги безпеки та масштабованості.

## 9.1 Provisioning на виробництві (обов’язково)
Для кожного контролера генерувати:
- `device_id` (UUID v4)
- `claim_code` (мін. 24+ chars, крипто-рандом)
- `hmac_secret` (32 bytes)

У БД:
- `devices.claim_code_hash = sha256(claim_code)`
- `device_credentials.hmac_secret = <bytes>`

На наклейці/QR:
- `device_id`
- `claim_code`
- бажано підписаний provisioning token/QR payload

> Важливо: ніколи не зберігати plain claim code в БД.

## 9.2 Claim flow користувача
1. Юзер логіниться.
2. В UI відкриває «Підключити контролер», сканує QR або вводить вручну.
3. Backend перевіряє hash claim code + cooldown + status.
4. Прив’язує owner до device і закриває повторний claim.

Опційно підсилити:
- short-lived challenge/nonce для підтвердження online-девайса,
- device attestation (на наступних ітераціях).

## 9.3 Прив’язка рослин до каналів
1. При створенні рослини юзер бачить доступні канали з `device-config`.
2. Канали, зайняті іншими рослинами, disabled у UI.
3. Backend повторно жорстко перевіряє унікальність.
4. При видаленні рослини канал звільняється автоматично (через cascade історії).

## 9.4 Телеметрія
- ESP32 відправляє batch з air/light + масив soil[channel].
- Сервер зберігає only mapped channels.
- Невідомі канали логуються в ignoredChannels.
- Надалі бажано додати калібрування raw->pct per-channel профілем.

## 9.5 Автополив (MVP -> production)
**MVP:**
- періодична задача рахує прогнози й створює planned commands.
- перед фактичним execute робить pre-execution double-check.

**Production:**
- виділений prediction service (queue + retries + observability).
- policy engine (quiet hours, safety caps, pump max duration, leak detection).

## 9.6 Керування світлом
- Команди LIGHT_ON/OFF/on_for через command queue.
- Валідація конфліктів активних команд вже є; додати state machine лампи (desired/actual state).

---

## 10) Що потрібно зробити в наступних етапах (пріоритетно)

## P0 (критично)
1. [x] Уніфікувати create-plant flow:
   - єдиний backend контракт: device/channel + optional user image + fallback perenual image.
2. [x] Додати UI для claim device + channel selection.
3. [x] Закрити доступ до чужої рослини в `profile/[id]` (owner check).
4. [x] Додати транзакційний anti-replay update last_seq.

## P1
5. [x] Додати `POST /api/v1/plants/:id/photo` (або multipart варіант в create).
6. [x] Додати scheduler (cron/worker) для прогнозів/автополиву.
7. [x] Додати e2e тестовий симулятор ESP32 (Node script/Postman/newman).

## P2
8. Secret rotation flow для device_credentials.
9. Device provisioning admin API/tool.
10. Спостережуваність: audit logs, метрики команд/ACK, алерти помилок.

---

## 11) Перевірка ваших ключових вимог проти поточного стану

- Реєстрація/логін: **є**.
- Прив’язка мікроконтролера до акаунта: **є (claim)**.
- Захист від вгадування і викрадення claim: **частково є** (hash + rate limit), можна посилити.
- Один ESP32 на кілька рослин (канали 1..N): **є** на рівні БД+API.
- Заборона повторного використання зайнятого сенсора: **є**.
- Очищення історії при видаленні рослини: **є** (cascade).
- Запис вимірів по кожній рослині окремо: **є** (channel mapping).
- MVP-прогноз: **є**.
- Повторна перевірка перед поливом: **є** для `water-now`.
- Кеш даних API рослин: **є** (`species_cache`).
- Фото користувача + fallback default: **частково** (повний flow не уніфікований).
- Керування фітолампою: **API є**, UI відсутній.
- Помпи (команди): **API/queue/ack є**, автоматичний планувальник ще ні.
- Імітований мікроконтролер для етапу тесту: **інтерфейс готовий**, симулятор окремо не реалізований у репо.

---

## 12) Рекомендований сценарій MVP тестування сервісів між собою

1. Створити тестовий device+credentials у БД.
2. Виконати claim через `/api/v1/devices/claim`.
3. Додати 2–4 рослини з прив’язкою до каналів.
4. Симулятором відправити measurements batch (із каналами 1..4).
5. Перевірити появу measurements по plant_id.
6. Викликати `/predictions` і перевірити `predictions` table.
7. Викликати `water-now` для plant.
8. Симулятором забрати `/iot/commands`, виконати ACK.
9. Перевірити `watering_events` + `last_watered_at`.
10. Видалити plant і перевірити cascade cleanup.

---

## 13) Підсумок

Проєкт уже має сильний фундамент для вашої задачі: secure claim, HMAC IoT API, multi-plant per controller, command queue з ACK, MVP prediction, species cache, OpenAPI документацію.

Головне, що залишилось для повноцінного «першого бойового циклу веб-частини + симулятора»: уніфікація create-plant flow (канали+фото), UI для device onboarding/керування, scheduler для автоматичних прогнозів/поливів, та кілька security hardening кроків (owner checks, transactional replay-protection, secret lifecycle).

---

## 14) Додатково: короткий шаблон майбутньої production-схеми взаємодій

`User UI -> /api/v1 -> DB`

`ESP Simulator/ESP32 -> /api/iot/v1 (HMAC) -> DB`

`Scheduler/Worker -> predictions + command planning -> device_commands`

`ESP poll commands -> execute pumps/light -> ack -> watering_events`

Це прямо відповідає вашому плану: **спочатку імітований контролер + MVP прогноз**, після валідації вебчастини — **реальний ESP32 + окремий production prediction service**.



## 15) Local Dev Environment

### ML Integration
- ML env: `D:\conda\envs\moonplants_ml`
- Scripts: `D:\Web\MoonPlants\moonplants_ml\`
- Activate: `conda activate moonplants_ml`
- ML exposes predictions via: (REST endpoint або file export — вибери)

### ESP32
- Arduino IDE project: `D:\Web\MoonPlants\ESP32\`
- Target board: ESP32 Dev Module
- Flashing: MANUAL — agent cannot flash, only edits .ino/.h files

### Agent cannot do (requires manual):
- Flash ESP32 (Arduino IDE → Upload)
- conda create envs
- Run jupyter notebooks
- Anything requiring GUI tools