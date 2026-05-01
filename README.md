# MoonPlants

A full-stack platform for indoor plant monitoring and care. Integrates an ESP32 IoT controller, a Python machine learning service, and a Next.js web application backed by Supabase.

> Diploma project.

---

## Features

- **Real-time monitoring** — soil moisture, temperature, humidity, and light via ESP32 sensors
- **Automated irrigation** — relay-controlled pump with configurable thresholds
- **ML predictions** — watering time-to-event and amount estimation (LightGBM / XGBoost)
- **Multi-device support** — claim/revoke devices, per-channel plant assignment
- **REST + IoT API** — separate JWT (user) and HMAC-SHA256 (device) authentication
- **OpenAPI docs** — live Swagger UI at `/api-docs`
- **Internationalisation** — English and Ukrainian (next-intl)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS 4, Shadcn UI, Recharts |
| Backend | Next.js Route Handlers, Server Actions, Zod, OpenAPI |
| Database | Supabase Postgres, Supabase Auth, Supabase Storage |
| IoT | ESP32, PlatformIO / Arduino Core, HMAC-SHA256 |
| ML | Python, LightGBM, XGBoost, FastAPI, Conda |

---

## Prerequisites

- Node.js 20+
- Python 3.11+ with Conda
- PlatformIO CLI (for firmware)
- Supabase project (or local Supabase via Docker)

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/DonatoMoon/moonplants.git
cd moonplants
cd apps/web && npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` inside `apps/web/` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PERENUAL_API_KEY=...
ML_API_URL=...
```

### 3. Run the web app

```bash
cd apps/web
npm run dev
```

App runs at `http://localhost:3000`. API docs at `http://localhost:3000/api-docs`.

### 4. Run the ML service

```bash
conda activate moonplants_ml
cd services/moonplants_api
uvicorn main:app --reload
```

### 5. Flash firmware

Open `hardware/esp32/` in PlatformIO and upload to the device. Configure Wi-Fi and API credentials in `platformio.ini` or the device provisioning flow.

---

## Development

```bash
# Web — lint
cd apps/web && npm run lint

# Web — full dev environment (PowerShell)
./startup.ps1

# ML — run tests
conda activate moonplants_ml
cd services/moonplants_ml && pytest
```

Database migrations are managed via Supabase CLI from `apps/web/supabase/migrations/`.

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full technical audit: data model, API security, IoT message flow, and ML pipeline design.

---

## License

MIT
