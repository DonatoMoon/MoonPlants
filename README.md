# MoonPlants Monorepo

Welcome to the MoonPlants project repository! This is a monorepo containing the web frontend, IoT firmware, machine learning models, and related documentation.

## AI Agent Instructions

> **IMPORTANT**: This is a monorepo. Please read the respective `DOMAIN_CONTEXT.md` files before modifying code in specific directories.

### Project Structure
- **/apps/web** - The Next.js web application (Frontend and API routes). Make sure to read `apps/web/DOMAIN_CONTEXT.md`.
- **/hardware/esp32** - Microcontroller firmware (C++). Make sure to read `hardware/esp32/DOMAIN_CONTEXT.md`.
- **/services/moonplants_ml** - Standard Python machine learning services. Make sure to read `services/moonplants_ml/DOMAIN_CONTEXT.md`.
- **/docs** - General project architecture, API documentation, and integration guides. Start with `docs/ARCHITECTURE.md`.
- **/.agents** - Global AI instructions and specific agent tools.

### Development Workflow
- Git tracking operates from this root folder.
- Do not commit local environment files `.env` or system specific files like `.idea`.
- For specific deployment steps, reference the `/docs` or the respective domain's context.
