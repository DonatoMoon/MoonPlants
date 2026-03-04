// lib/openapi/index.ts
// Assembles the complete OpenAPI 3.1 specification for MoonPlants API

import type { OpenAPIV3_1 } from "openapi-types";
import { schemas, securitySchemes } from "./components";
import { v1DevicePaths } from "./paths/v1.devices";
import { v1PlantPaths } from "./paths/v1.plants";
import { iotV1Paths } from "./paths/iot.v1";
import { miscPaths } from "./paths/misc";

export function getOpenApiSpec(): OpenAPIV3_1.Document {
  return {
    openapi: "3.1.0",
    info: {
      title: "MoonPlants API",
      version: "1.0.0",
      description:
        "REST API for MoonPlants — smart plant monitoring and automated watering system. " +
        "Consists of two namespaces:\n\n" +
        "- **`/api/v1/`** — User-facing endpoints (Supabase JWT auth)\n" +
        "- **`/api/iot/v1/`** — Device-facing endpoints (HMAC-SHA256 auth)",
      contact: {
        name: "MoonPlants",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development",
      },
      {
        url: "https://your-production-domain.com",
        description: "Production (replace with actual domain)",
      },
    ],
    tags: [
      {
        name: "Devices",
        description: "User-facing device management (list, claim, control light)",
      },
      {
        name: "Plants",
        description:
          "User-facing plant management (CRUD, measurements, predictions, watering)",
      },
      {
        name: "IoT Device",
        description:
          "Device-facing endpoints for ESP32 firmware (HMAC auth required)",
      },
      {
        name: "Utility",
        description: "Helper endpoints (species autocomplete, etc.)",
      },
    ],
    components: {
      schemas,
      securitySchemes,
    },
    paths: {
      ...v1DevicePaths,
      ...v1PlantPaths,
      ...iotV1Paths,
      ...miscPaths,
    },
  };
}

