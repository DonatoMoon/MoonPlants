# Domain Context: Next.js Web Frontend

This directory contains the main web application for the MoonPlants project.

## Architecture
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS, Shadcn UI components.
- **Backend/DB**: Supabase (PostgreSQL, Auth, Edge Functions).
- **Core Functionality**: User dashboard, IoT device management, ML dashboard integrations.

## AI Agent Instructions
- **File Structure**: Always look into `app/`, `components/`, and `lib/`.
- **Styling**: Maintain a modern, responsive, and visually appealing design using Tailwind CSS. Use glassmorphism and subtle animations where appropriate.
- **Components**: Adhere to the existing design system. Prefer Shadcn components when available.
- **Data Fetching**: Prefer Server Components for data fetching. Use Client Components (`"use client"`) only when interactivity (hooks, state) is strictly needed.
