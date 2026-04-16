# MoonPlants — Claude Code Configuration

This file provides the core identity, architectural rules, and operational mandates for Claude Code working on the MoonPlants project.

## Project Identity

MoonPlants is a full-stack platform for indoor plant monitoring and care, integrating IoT (ESP32), Machine Learning (Python), and a modern Web Frontend (Next.js 15, Tailwind 4, Supabase).

## Core Documentation (Sources of Truth)

- **Architecture & API**: `docs/ARCHITECTURE.md` — comprehensive technical audit and roadmap.
- **Frontend/API Context**: `apps/web/DOMAIN_CONTEXT.md`
- **IoT/Firmware Context**: `hardware/esp32/DOMAIN_CONTEXT.md`
- **ML/Analytics Context**: `services/moonplants_ml/DOMAIN_CONTEXT.md`

## Project Structure

- `/apps/web` — Next.js 15 web app (App Router, React 19). Read `apps/web/DOMAIN_CONTEXT.md` before modifying.
- `/hardware/esp32` — ESP32 C++ firmware. Read `hardware/esp32/DOMAIN_CONTEXT.md` before modifying.
- `/services/moonplants_ml` — Standard Python ML services. Read `services/moonplants_ml/DOMAIN_CONTEXT.md` before modifying.
- `/services/moonplants_lstm` — LSTM/XAI implementations. Separate from `moonplants_ml`.
- `/docs` — Architecture, API docs. Start with `docs/ARCHITECTURE.md`.
- `/.сlaude/skills` — Project-level Claude Code skills.

## Tech Stack

**Frontend:**
- Next.js 15 (App Router), React 19
- TailwindCSS 4, Shadcn UI (Radix), Lucide React
- Recharts (data viz)

**Backend:**
- Next.js Route Handlers (`app/api/v1/*`, `app/api/iot/v1/*`)
- Zod validation, OpenAPI/Swagger (`/api-docs`)
- Supabase Auth, Postgres, Storage

**IoT:**
- ESP32, PlatformIO/Arduino Core
- HMAC-SHA256 auth (`lib/iot/hmac.ts`)

**ML:**
- Python, Conda env `moonplants_ml`
- pytest for tests

## Development Workflow

- **Startup**: Use `startup.ps1` to launch the full dev environment (WebStorm, Arduino IDE, Next.js dev server, ML Conda env).
- **Web**: `cd apps/web && npm run dev`
- **Lint**: `npm run lint`
- **ML tests**: `pytest` inside `services/moonplants_ml/`
- **Git**: Never commit or stage changes unless explicitly asked.
- **Secrets**: Never log or commit `.env` files or HMAC secrets.

## Code Standards

- **Python**: PEP 8, pytest for tests.
- **TypeScript/React**: Modern patterns, Server Components by default, Server Actions for mutations.
- **Styling**: Glassmorphism aesthetic, Tailwind 4 conventions, Shadcn components preferred.
- **IoT**: Respect memory constraints on ESP32; no dynamic allocation in heavy loops.
- **API**: Keep `public/openapi.json` updated when modifying API routes.

## Domain Boundaries

- `moonplants_ml` (standard ML) and `moonplants_lstm` (LSTM/XAI) are strictly separate — do not mix them.
- IoT HMAC secrets are in `device_credentials` table (service-role only) — handle with extreme care.
- One soil channel = one plant per device (DB unique constraint).
