# Domain Context: Next.js Web Frontend

This directory contains the main web application for the MoonPlants project.

## Architecture & Tech Stack
- **Framework**: Next.js 15 (App Router)
- **React**: React 19 (using Server Actions, RSC, and Suspense)
- **Styling**: 
  - Tailwind CSS 4 (Latest features)
  - Shadcn UI (Radix-based components)
  - Lucide React (Icons)
- **State & Data**:
  - Supabase (PostgreSQL, Auth, Storage)
  - TanStack Query (optional for client-side)
  - Recharts (Data visualization)
- **Backend/API**:
  - Next.js Route Handlers in `app/api/v1/*` and `app/api/iot/v1/*`
  - Zod for payload validation
  - OpenAPI/Swagger integration

## AI Agent Instructions
- **File Structure**: 
  - `app/` - Pages and API routes.
  - `components/` - Shared UI (shadcn in `ui/`, domain-specific in others).
  - `lib/` - Utilities, DB clients, and domain logic (IoT, Predictions).
- **Styling Mandates**: 
  - Maintain a modern, high-quality, "glassmorphism" aesthetic.
  - Use subtle transitions and interactive feedback.
  - Strictly follow Tailwind 4 conventions.
- **Components**: 
  - Prefer Shadcn components. 
  - Use `lucide-react` for all icons.
  - Ensure accessibility (ARIA, focus states).
- **Data Fetching**: 
  - Default to Server Components. 
  - Use Server Actions for all mutations (Auth, Plant creation).
  - Use Client Components only for charts, forms, and interactive UI bits.
- **IoT Integration**: 
  - HMAC verification logic is in `lib/iot/hmac.ts`.
  - API schemas are in `lib/iot/schemas.ts`.
