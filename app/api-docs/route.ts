// app/api-docs/route.ts
// GET /api-docs — serves a standalone Swagger UI HTML page
// Uses Swagger UI CDN — fully isolated from Next.js/React/Turbopack

import { NextResponse } from "next/server";

const CDN = "https://unpkg.com/swagger-ui-dist@5.18.2";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MoonPlants — API Docs</title>
  <link rel="stylesheet" href="${CDN}/swagger-ui.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; }

    /* ── top bar ───────────────────────────────────────────────── */
    .topbar {
      background: #1a1a2e;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .topbar-title {
      color: #a8d8a8;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: .5px;
      text-decoration: none;
    }
    .topbar-badge {
      background: #2d6a4f;
      color: #d8f3dc;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      letter-spacing: .3px;
    }

    /* ── postman panel ─────────────────────────────────────────── */
    .postman-panel {
      background: #1a1a2e;
      border-bottom: 1px solid #2d2d50;
      padding: 0 24px;
    }
    .postman-panel summary {
      cursor: pointer;
      color: #7ec8e3;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 0;
      user-select: none;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .postman-panel summary::-webkit-details-marker { display: none; }
    .postman-panel summary::before {
      content: "▶";
      font-size: 10px;
      transition: transform .2s;
      display: inline-block;
    }
    .postman-panel[open] summary::before { transform: rotate(90deg); }
    .postman-body {
      padding: 0 0 16px 0;
      color: #c8c8d8;
      font-size: 13px;
      line-height: 1.6;
    }
    .postman-body p { margin: 8px 0; }
    .postman-body strong { color: #e0e0f0; }
    .postman-body code {
      background: #2a2a4a;
      color: #a8d8a8;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
      font-family: "Fira Code", "Cascadia Code", monospace;
    }
    .postman-body .cmd {
      display: inline-block;
      background: #0d0d1a;
      color: #a8d8a8;
      padding: 6px 14px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 13px;
      margin: 4px 0;
      border: 1px solid #2d6a4f;
    }
    .postman-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
    }
    @media (max-width: 700px) { .postman-grid { grid-template-columns: 1fr; } }
    .postman-grid table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .postman-grid th {
      background: #2a2a4a;
      color: #a8d8a8;
      padding: 5px 10px;
      text-align: left;
      font-weight: 600;
    }
    .postman-grid td {
      padding: 5px 10px;
      border-top: 1px solid #2d2d50;
      vertical-align: top;
    }
    .tag-iot  { color: #f4a261; }
    .tag-user { color: #7ec8e3; }

    /* hide the built-in swagger topbar */
    .swagger-ui .topbar { display: none !important; }
  </style>
</head>
<body>

  <!-- ── Top bar ───────────────────────────────────────────────────── -->
  <div class="topbar">
    <span class="topbar-title">🌿 MoonPlants API</span>
    <span class="topbar-badge">OpenAPI 3.1</span>
  </div>

  <!-- ── Postman info panel ────────────────────────────────────────── -->
  <div class="postman-panel">
    <details>
      <summary>📦 Postman Collection &amp; Environments</summary>
      <div class="postman-body">
        <p>Колекція та environments знаходяться у репозиторії в папці <code>postman/</code>. Імпортуй їх у Postman.</p>
        <p>Для регенерації: <span class="cmd">npm run postman:export</span></p>

        <div class="postman-grid">
          <div>
            <table>
              <thead><tr><th colspan="2">Файли</th></tr></thead>
              <tbody>
                <tr><td><code>MoonPlants.postman_collection.json</code></td><td>Вся колекція</td></tr>
                <tr><td><code>MoonPlants.local.postman_environment.json</code></td><td><code>baseUrl=http://localhost:3000</code></td></tr>
                <tr><td><code>MoonPlants.prod.postman_environment.json</code></td><td>Production (замінити <code>baseUrl</code>)</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <table>
              <thead><tr><th>Змінна</th><th>Опис</th></tr></thead>
              <tbody>
                <tr><td><code>baseUrl</code></td><td>Базовий URL API</td></tr>
                <tr><td><code class="tag-user">USER_ACCESS_TOKEN</code></td><td>Supabase JWT (<code>/api/v1/**</code>)</td></tr>
                <tr><td><code class="tag-iot">DEVICE_ID</code></td><td>UUID девайса (<code>/api/iot/v1/**</code>)</td></tr>
                <tr><td><code class="tag-iot">DEVICE_SECRET</code></td><td>HMAC secret девайса</td></tr>
                <tr><td><code class="tag-iot">DEVICE_SEQ</code></td><td>Лічильник (auto-increment у pre-request script)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <p style="margin-top:12px">
          Папка <strong>IoT Device</strong> містить pre-request script, який автоматично обчислює всі HMAC-заголовки:
          <code>X-Device-Id</code>, <code>X-Device-Seq</code>, <code>X-Device-Timestamp</code>,
          <code>X-Content-SHA256</code>, <code>X-Device-Signature</code> — достатньо заповнити лише
          <code class="tag-iot">DEVICE_ID</code> та <code class="tag-iot">DEVICE_SECRET</code>.
        </p>
      </div>
    </details>
  </div>

  <!-- ── Swagger UI ────────────────────────────────────────────────── -->
  <div id="swagger-ui"></div>

  <script src="${CDN}/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      docExpansion: "list",
      defaultModelsExpandDepth: 1,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      deepLinking: true,
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
