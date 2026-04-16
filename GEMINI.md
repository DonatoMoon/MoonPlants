# MoonPlants — Foundational Mandates for Gemini CLI

This file provides the core identity, architectural rules, and operational mandates for AI agents working on the MoonPlants project.

## Project Identity
MoonPlants is a full-stack platform for indoor plant monitoring and care, integrating IoT (ESP32), Machine Learning (Python/LSTM), and a modern Web Frontend (Next.js 15, Tailwind 4, Supabase).

## Core Documentation (Sources of Truth)
- **Architecture & API**: `docs/ARCHITECTURE.md` (Comprehensive technical audit and roadmap).
- **Frontend/API Context**: `apps/web/DOMAIN_CONTEXT.md`.
- **IoT/Firmware Context**: `hardware/esp32/DOMAIN_CONTEXT.md`.
- **ML/Analytics Context**: `services/moonplants_ml/DOMAIN_CONTEXT.md` and `services/moonplants_lstm/DOMAIN_CONTEXT.md`.

## Foundational Mandates for AI Agents

### 1. Mandatory Skill Activation
To ensure the highest quality and consistency, you **MUST** activate relevant skills at the start of every session or complex task.
- **Process Skill**: Always activate `using-superpowers` first to establish the expert workflow.
- **Frontend/UI**: Use `frontend-design`, `shadcn`, and `next-best-practices` when modifying `apps/web`.
- **Backend/DB**: Use `supabase-postgres-best-practices` when modifying database schemas or Supabase integrations.
- **IoT/Firmware**: Use `esp32-firmware-engineer` when working in `hardware/esp32`.
- **Data/Experiments**: Use `jupyter-notebook` for ML explorations.

### 2. Contextual Awareness & Entry Points
- **Primary Entry Point**: The project uses `startup.ps1` (PowerShell) to launch the entire environment (WebStorm, Arduino IDE, Next.js dev server, and ML Conda environment).
- **Conda Env**: The ML services use a Conda environment named `moonplants_ml`.
- **Web App**: The Next.js app is located in `apps/web/` and uses `npm run dev`.
- **IoT**: Firmware is in `hardware/esp32/`.
- Before making changes, always read the relevant `DOMAIN_CONTEXT.md`.
- Adhere to the design system (modern, glassmorphism, responsive) defined in `apps/web/DOMAIN_CONTEXT.md`.
- Respect the strict separation between `moonplants_ml` (standard ML) and `moonplants_lstm` (LSTM/XAI).

### 3. Development Workflow
- **Git**: Never commit or stage changes unless explicitly asked.
- **Security**: Never log or commit secrets. HMAC secrets for IoT must be handled with extreme care (see `docs/ARCHITECTURE.md` section 9.1).
- **Validation**: Always verify changes with the project's build/test commands (e.g., `npm run lint`, `pytest`).

### 4. Code Quality
- Follow `PEP 8` for Python and modern TypeScript/React patterns for the web.
- Maintain the OpenAPI documentation (`public/openapi.json`) when modifying API routes.

## AI Expert Instructions
> "If you think there is even a 1% chance a skill might apply, you ABSOLUTELY MUST invoke it." — *using-superpowers* mandate.
