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
