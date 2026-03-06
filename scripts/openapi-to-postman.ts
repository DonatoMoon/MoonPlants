// scripts/openapi-to-postman.ts
// Converts public/openapi.json → Postman collection + environments.
// Run: npx tsx scripts/openapi-to-postman.ts

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – openapi-to-postmanv2 has no type declarations
import Converter from "openapi-to-postmanv2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const specPath = resolve(__dirname, "../public/openapi.json");
const outDir = resolve(__dirname, "../postman");

mkdirSync(outDir, { recursive: true });

const specContent = readFileSync(specPath, "utf-8");
const specJson = JSON.parse(specContent) as Record<string, unknown>;

const conversionOptions = {
  requestNameSource: "Fallback" as const,
  indentCharacter: "Space" as const,
  folderStrategy: "Tags",
  includeAuthInfoInExample: true,
  exampleParametersResolution: "example",
  enableOptionalParameters: false,
};

Converter.convert(
  { type: "json", data: specJson },
  conversionOptions,
  (
    error: Error | null,
    result: {
      result: boolean;
      output: Array<{ type: string; data: unknown }>;
      reason?: string;
    }
  ) => {
    if (error || !result.result) {
      console.error("❌  Conversion failed:", error ?? result.reason);
      process.exit(1);
    }

    // Find the collection output
    const collectionOutput = result.output.find((o) => o.type === "collection");
    if (!collectionOutput) {
      console.error("❌  No collection in converter output");
      process.exit(1);
    }

    const collection = collectionOutput.data as {
      info?: { name?: string };
      variable?: Array<{ key: string; value: string }>;
      item?: unknown[];
    };

    // Ensure collection name is correct
    if (collection.info) {
      collection.info.name = "MoonPlants";
    }

    // ── Inject auth variables into items ──────────────────────────────────
    // Ensure the collection has a baseUrl variable
    if (!collection.variable) {
      collection.variable = [];
    }

    const hasBaseUrl = collection.variable.some((v) => v.key === "baseUrl");
    if (!hasBaseUrl) {
      collection.variable.push({ key: "baseUrl", value: "{{baseUrl}}" });
    }

    // Inject HMAC pre-request script into the IoT Device folder
    injectIotAuth(collection.item ?? []);

    // Write collection
    const collectionPath = resolve(outDir, "MoonPlants.postman_collection.json");
    writeFileSync(collectionPath, JSON.stringify(collection, null, 2), "utf-8");
    console.log(`✅  Collection → ${collectionPath}`);

    // Write local environment
    const localEnv = buildEnvironment("MoonPlants Local", {
      baseUrl: "http://localhost:3000",
      USER_ACCESS_TOKEN: "",
      DEVICE_ID: "",
      DEVICE_SECRET: "",
    });
    const localPath = resolve(outDir, "MoonPlants.local.postman_environment.json");
    writeFileSync(localPath, JSON.stringify(localEnv, null, 2), "utf-8");
    console.log(`✅  Local env  → ${localPath}`);

    // Write production environment
    const prodEnv = buildEnvironment("MoonPlants Production", {
      baseUrl: "https://your-production-domain.com",
      USER_ACCESS_TOKEN: "",
      DEVICE_ID: "",
      DEVICE_SECRET: "",
    });
    const prodPath = resolve(outDir, "MoonPlants.prod.postman_environment.json");
    writeFileSync(prodPath, JSON.stringify(prodEnv, null, 2), "utf-8");
    console.log(`✅  Prod env   → ${prodPath}`);
  }
);

// ── Helpers ────────────────────────────────────────────────────────────────

function buildEnvironment(
  name: string,
  values: Record<string, string>
): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    name,
    values: Object.entries(values).map(([key, value]) => ({
      key,
      value,
      type: key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")
        ? "secret"
        : "default",
      enabled: true,
    })),
    _postman_variable_scope: "environment",
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: "scripts/openapi-to-postman.ts",
  };
}

/** Recursively walks the item tree and injects HMAC pre-request script into IoT Device folder */
function injectIotAuth(items: unknown[]): void {
  for (const item of items) {
    const folder = item as {
      name?: string;
      item?: unknown[];
      event?: Array<{ listen: string; script: { exec: string[] } }>;
      auth?: unknown;
    };

    if (folder.name === "IoT Device" && Array.isArray(folder.item)) {
      // Add folder-level pre-request script for HMAC signing
      if (!folder.event) folder.event = [];
      const alreadyHas = folder.event.some((e) => e.listen === "prerequest");
      if (!alreadyHas) {
        folder.event.push({
          listen: "prerequest",
          script: {
            exec: [
              "// ── MoonPlants IoT HMAC-SHA256 Pre-request Script ──",
              "// Variables needed in environment:",
              "//   DEVICE_ID     – device UUID",
              "//   DEVICE_SECRET – HMAC secret (hex or utf-8)",
              "",
              "const deviceId = pm.environment.get('DEVICE_ID');",
              "const secret   = pm.environment.get('DEVICE_SECRET');",
              "",
              "if (!deviceId || !secret) {",
              "  console.warn('[IoT Auth] DEVICE_ID or DEVICE_SECRET not set in environment.');",
              "  return;",
              "}",
              "",
              "const method    = pm.request.method.toUpperCase();",
              "const url       = pm.request.url;",
              "const path      = '/' + url.getPath();",
              "const seq       = parseInt(pm.environment.get('DEVICE_SEQ') || '1', 10);",
              "const timestamp = Math.floor(Date.now() / 1000);",
              "const body      = pm.request.body ? pm.request.body.toString() : '';",
              "",
              "// SHA-256 of body",
              "const bodyHash = CryptoJS.SHA256(body).toString(CryptoJS.enc.Hex);",
              "",
              "// Canonical string",
              "const canonical = [method, path, deviceId, seq, timestamp, bodyHash].join('\\n');",
              "",
              "// HMAC-SHA256 → base64url",
              "const hmac = CryptoJS.HmacSHA256(canonical, secret);",
              "const signature = hmac.toString(CryptoJS.enc.Base64)",
              "  .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');",
              "",
              "// Set headers",
              "pm.request.headers.upsert({ key: 'X-Device-Id',        value: deviceId });",
              "pm.request.headers.upsert({ key: 'X-Device-Seq',       value: String(seq) });",
              "pm.request.headers.upsert({ key: 'X-Device-Timestamp', value: String(timestamp) });",
              "pm.request.headers.upsert({ key: 'X-Content-SHA256',   value: bodyHash });",
              "pm.request.headers.upsert({ key: 'X-Device-Signature', value: signature });",
              "",
              "// Increment seq for next request",
              "pm.environment.set('DEVICE_SEQ', String(seq + 1));",
            ],
          },
        });
      }
    }

    // Recurse into sub-folders
    if (Array.isArray(folder.item)) {
      injectIotAuth(folder.item);
    }
  }
}



