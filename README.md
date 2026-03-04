This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

---

## API Documentation (Swagger / OpenAPI)

### View interactive Swagger UI

Start the dev server and open:

```
http://localhost:3000/api-docs
```

The Swagger UI renders the full OpenAPI 3.1 spec with **Try It Out** support.

The raw JSON spec is also available at:

```
http://localhost:3000/api/openapi.json
```

### API namespaces

| Namespace | Auth | Description |
|---|---|---|
| `/api/v1/` | Supabase JWT (`BearerAuth`) | User-facing endpoints (devices, plants, measurements, predictions, watering) |
| `/api/iot/v1/` | HMAC-SHA256 (`IotHmac`) | Device-facing endpoints for ESP32 firmware |
| `/api/perenual-autocomplete` | None | Species search helper |

### Update the OpenAPI spec

The spec lives in `lib/openapi/` as TypeScript source of truth:

- `lib/openapi/index.ts` — assembles the full spec
- `lib/openapi/components.ts` — schemas and security schemes
- `lib/openapi/paths/v1.devices.ts` — `/api/v1/devices/**` paths
- `lib/openapi/paths/v1.plants.ts` — `/api/v1/plants/**` paths
- `lib/openapi/paths/iot.v1.ts` — `/api/iot/v1/**` paths
- `lib/openapi/paths/misc.ts` — miscellaneous paths

After editing the spec, re-export the JSON file:

```bash
npm run openapi:export
```

This writes/updates `public/openapi.json`.

### Generate Postman collection

```bash
npm run postman:export
```

This runs both `openapi:export` and the Postman converter. It creates/updates:

| File | Description |
|---|---|
| `postman/MoonPlants.postman_collection.json` | Full Postman collection (all endpoints, grouped by tag) |
| `postman/MoonPlants.local.postman_environment.json` | Local environment (`baseUrl=http://localhost:3000`) |
| `postman/MoonPlants.prod.postman_environment.json` | Production environment (replace `baseUrl` placeholder) |

#### Postman variables to fill in

| Variable | Used for | Description |
|---|---|---|
| `baseUrl` | All requests | Base URL of the API |
| `USER_ACCESS_TOKEN` | `/api/v1/**` | Supabase JWT — obtained via sign-in |
| `DEVICE_ID` | `/api/iot/v1/**` | Device UUID |
| `DEVICE_SECRET` | `/api/iot/v1/**` | Device HMAC secret |
| `DEVICE_SEQ` | `/api/iot/v1/**` | Auto-incremented by pre-request script |

The **IoT Device** folder contains a pre-request script that automatically computes all HMAC headers (`X-Device-Id`, `X-Device-Seq`, `X-Device-Timestamp`, `X-Content-SHA256`, `X-Device-Signature`) from the environment variables above.


## Supabase CLI — Database Migrations Workflow

Schema is managed **exclusively** through Supabase CLI migrations.  
**SQL Editor is no longer used.**

### ⚠️ Key rules

| Action | Effect on Cloud DB |
|---|---|
| `git push` | ❌ Does NOT change the database |
| `npm run db:push` | ✅ Applies pending migrations to Cloud Supabase |

---

### 1. One-time setup (per developer machine)

#### Authenticate with Supabase CLI

```bash
# Option A — interactive browser login (recommended)
npx supabase login

# Option B — CI / headless (set env var, never commit the token)
# Add to .env.local:
# SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx
```

#### Link to your Cloud project

```bash
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

> Find `<YOUR_PROJECT_REF>` in Supabase Dashboard → Project Settings → General → **Reference ID**  
> Example: `npx supabase link --project-ref abcdefghijklmnop`

---

### 2. Available npm scripts

| Script | Command | Description |
|---|---|---|
| `npm run db:pull` | `supabase db pull` | Pull current Cloud schema into a new migration file |
| `npm run db:push` | `supabase db push` | Apply all pending local migrations to Cloud |
| `npm run db:new <name>` | `supabase migration new` | Create a new empty migration file |
| `npm run db:status` | `supabase migration list` | Show applied vs pending migrations |
| `npm run db:reset` | _(disabled)_ | NOT used for Cloud projects |

---

### 3. Standard migration workflow

```bash
# Step 1 — Create a new migration file
npm run db:new add_notifications_table
# → Creates: supabase/migrations/YYYYMMDDHHMMSS_add_notifications_table.sql

# Step 2 — Edit the generated SQL file
# supabase/migrations/YYYYMMDDHHMMSS_add_notifications_table.sql

# Step 3 — Apply to Cloud Supabase
npm run db:push

# Step 4 — Commit to git
git add supabase/migrations/
git commit -m "feat: add notifications table"
git push
```

> `git push` only saves the migration **file** in the repository.  
> The database is only changed by `npm run db:push`.

---

### 4. Project structure

```
supabase/
├── config.toml          # Supabase CLI config (committed)
└── migrations/
    └── 20260302000000_initial_schema.sql   # Baseline schema
    └── YYYYMMDDHHMMSS_<name>.sql           # Future migrations
```

---

### 5. Security

- **Never** hardcode `service_role` key or `SUPABASE_ACCESS_TOKEN` in source code.
- Use `.env.local` for secrets (already git-ignored via `.env*` rule).
- CI/CD: set `SUPABASE_ACCESS_TOKEN` as an environment secret in GitHub/Vercel.
- `supabase/config.toml` and `supabase/migrations/` **are safe to commit** — they contain no secrets.

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
