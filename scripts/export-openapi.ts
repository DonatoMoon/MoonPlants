// scripts/export-openapi.ts
// Generates public/openapi.json from the OpenAPI spec source of truth.
// Run: npx tsx scripts/export-openapi.ts

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getOpenApiSpec } from "../lib/openapi/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outPath = resolve(__dirname, "../public/openapi.json");
const spec = getOpenApiSpec();
const json = JSON.stringify(spec, null, 2);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json, "utf-8");

console.log(`✅  OpenAPI spec exported → ${outPath}`);
console.log(`    Paths: ${Object.keys(spec.paths ?? {}).length}`);
console.log(`    Schemas: ${Object.keys(spec.components?.schemas ?? {}).length}`);


