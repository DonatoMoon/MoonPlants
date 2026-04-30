// lib/openapi/components.ts
// OpenAPI 3.1 reusable components: schemas and security schemes
// Note: OpenAPI 3.1 uses type arrays for nullable (["string","null"]) instead of nullable:true

import type { OpenAPIV3_1 } from "openapi-types";

// Helper: produce a nullable schema (OpenAPI 3.1 style)
function nullable(
  base: OpenAPIV3_1.NonArraySchemaObject
): OpenAPIV3_1.SchemaObject {
  return { ...base, type: [base.type as string, "null"] } as unknown as OpenAPIV3_1.SchemaObject;
}

export const securitySchemes: Record<string, OpenAPIV3_1.SecuritySchemeObject> =
  {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "Supabase JWT access token. Pass via Authorization: Bearer <token>",
    },
    IotHmac: {
      type: "apiKey",
      in: "header",
      name: "X-Device-Signature",
      description:
        "HMAC-SHA256 device signature. IoT endpoints require all 5 headers: " +
        "X-Device-Id, X-Device-Seq, X-Device-Timestamp, X-Content-SHA256, X-Device-Signature. " +
        "Canonical string = METHOD\\nPATH\\nX-Device-Id\\nX-Device-Seq\\nX-Device-Timestamp\\nX-Content-SHA256",
    },
  };

export const schemas: Record<string, OpenAPIV3_1.SchemaObject> = {
  // ── Shared ───────────────────────────────────────────────────────────────
  ErrorResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string", example: "Unauthorized" },
    },
  },

  // ── Device ───────────────────────────────────────────────────────────────
  Device: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      display_name: { type: "string", example: "Balcony Hub #1" },
      channels_count: { type: "integer", minimum: 1, maximum: 16, example: 4 },
      supports_pumps: { type: "boolean" },
      supports_light: { type: "boolean" },
      firmware_version: nullable({ type: "string", example: "1.2.0" }),
      status: {
        type: "string",
        enum: ["unclaimed", "claimed", "revoked"],
        example: "claimed",
      },
      last_seen_at: nullable({ type: "string", format: "date-time" }),
      created_at: { type: "string", format: "date-time" },
    },
  },

  DeviceDetail: {
    type: "object",
    properties: {
      device: { $ref: "#/components/schemas/Device" },
      plants: {
        type: "array",
        items: { $ref: "#/components/schemas/PlantSummary" },
      },
      pendingCommands: {
        type: "array",
        items: { $ref: "#/components/schemas/DeviceCommand" },
      },
    },
  },

  DeviceCommand: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      type: {
        type: "string",
        enum: ["PUMP_WATER", "PUMP_WATER_SEC", "LIGHT_ON", "LIGHT_OFF"],
        example: "PUMP_WATER",
      },
      payload: { type: "object", additionalProperties: true },
      status: {
        type: "string",
        enum: ["queued", "sent", "acked", "failed", "expired", "canceled"],
        example: "queued",
      },
      created_at: { type: "string", format: "date-time" },
      send_after: nullable({ type: "string", format: "date-time" }),
      expires_at: nullable({ type: "string", format: "date-time" }),
    },
  },

  // ── Plant ─────────────────────────────────────────────────────────────────
  PlantSummary: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string", example: "Monstera Deliciosa" },
      species_name: { type: "string" },
      soil_channel: nullable({ type: "integer" }),
      image_url: nullable({ type: "string" }),
      auto_watering_enabled: { type: "boolean" },
      auto_light_enabled: { type: "boolean" },
    },
  },

  Plant: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      owner_user_id: { type: "string", format: "uuid" },
      device_id: nullable({ type: "string", format: "uuid" }),
      name: { type: "string", example: "Monstera Deliciosa" },
      species_name: { type: "string" },
      species_cache_id: nullable({ type: "string", format: "uuid" }),
      soil_channel: nullable({ type: "integer" }),
      image_url: nullable({ type: "string" }),
      image_source: nullable({ type: "string", enum: ["user", "perenual", "none"] }),
      auto_watering_enabled: { type: "boolean" },
      auto_light_enabled: { type: "boolean" },
      age_months: nullable({ type: "integer" }),
      pot_height_cm: nullable({ type: "number" }),
      pot_diameter_cm: nullable({ type: "number" }),
      pot_volume_ml: nullable({ type: "integer" }),
      last_watered_at: nullable({ type: "string", format: "date-time" }),
      created_at: { type: "string", format: "date-time" },
    },
  },

  CreatePlantRequest: {
    type: "object",
    required: ["name", "speciesName"],
    properties: {
      deviceId: {
        type: "string",
        format: "uuid",
        description: "Optional: link to a claimed device",
      },
      soilChannel: {
        type: "integer",
        minimum: 1,
        maximum: 16,
        description: "Device channel index (required when deviceId set)",
      },
      name: { type: "string", minLength: 1, maxLength: 200, example: "My Monstera" },
      speciesName: {
        type: "string",
        minLength: 1,
        maxLength: 300,
        example: "Monstera deliciosa",
      },
      perenualId: {
        type: "integer",
        description: "Perenual species ID to auto-fetch image/data",
      },
      potVolumeMl: { type: "integer", minimum: 1 },
      potDiameterCm: { type: "number", minimum: 0 },
      potHeightCm: { type: "number", minimum: 0 },
      lastWateredAt: nullable({ type: "string", format: "date-time" }),
    },
  },

  // ── Measurement ───────────────────────────────────────────────────────────
  Measurement: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      soil_moisture_pct: nullable({ type: "number" }),
      soil_moisture_raw: nullable({ type: "integer" }),
      air_temp_c: nullable({ type: "number" }),
      air_humidity_pct: nullable({ type: "number" }),
      light_lux: nullable({ type: "number" }),
      battery_v: nullable({ type: "number" }),
      measured_at: { type: "string", format: "date-time" },
    },
  },

  // ── Prediction ────────────────────────────────────────────────────────────
  Prediction: {
    type: "object",
    properties: {
      plant_id: { type: "string", format: "uuid" },
      predicted_at: { type: "string", format: "date-time" },
      next_watering_at: nullable({ type: "string", format: "date-time" }),
      confidence: nullable({ type: "number", minimum: 0, maximum: 1 }),
      reason: nullable({ type: "string" }),
      should_water_now: { type: "boolean" },
    },
  },

  // ── Watering Event ────────────────────────────────────────────────────────
  WateringEvent: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      plant_id: { type: "string", format: "uuid" },
      source: {
        type: "string",
        enum: ["manual", "auto", "device"],
        example: "manual",
      },
      water_ml: nullable({ type: "integer" }),
      happened_at: { type: "string", format: "date-time" },
      note: nullable({ type: "string" }),
    },
  },

  CreateWateringEventRequest: {
    type: "object",
    properties: {
      waterMl: {
        type: "integer",
        minimum: 1,
        description: "Amount of water used in millilitres",
      },
      happenedAt: {
        type: "string",
        format: "date-time",
        description: "ISO timestamp; defaults to now",
      },
      note: { type: "string", maxLength: 500 },
    },
  },

  // ── IoT Measurement Payload ───────────────────────────────────────────────
  IotMeasurementPayload: {
    type: "object",
    required: ["measuredAt", "soil"],
    properties: {
      measuredAt: {
        type: "integer",
        description: "Unix epoch seconds",
        example: 1709481600,
      },
      air: {
        type: "object",
        properties: {
          tempC: { type: "number", minimum: -50, maximum: 100, example: 22.5 },
          humidityPct: { type: "number", minimum: 0, maximum: 100, example: 55 },
        },
      },
      lightLux: { type: "number", minimum: 0, example: 2400 },
      soil: {
        type: "array",
        minItems: 1,
        maxItems: 16,
        items: {
          type: "object",
          required: ["channel", "moistureRaw"],
          properties: {
            channel: { type: "integer", minimum: 1, maximum: 16 },
            moistureRaw: { type: "integer", minimum: 0, maximum: 65535 },
          },
        },
      },
      batteryV: { type: "number", minimum: 0, maximum: 10, example: 3.8 },
      rssiDbm: { type: "integer", minimum: -120, maximum: 0, example: -67 },
    },
  },

  // ── Command Ack ───────────────────────────────────────────────────────────
  CommandAckPayload: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["ok", "failed", "partial"] },
      executedAt: {
        type: "integer",
        description: "Unix epoch seconds when executed",
      },
      result: {
        type: "object",
        additionalProperties: true,
        description: "Optional extra result data",
      },
    },
  },

  // ── Claim Device ─────────────────────────────────────────────────────────
  ClaimDeviceRequest: {
    type: "object",
    required: ["deviceId", "claimCode"],
    properties: {
      deviceId: { type: "string", format: "uuid" },
      claimCode: {
        type: "string",
        minLength: 16,
        maxLength: 64,
        example: "CLAIM-XXXX-YYYY-ZZZZ",
      },
    },
  },

  // ── Light Command ─────────────────────────────────────────────────────────
  LightCommandRequest: {
    type: "object",
    required: ["mode"],
    properties: {
      mode: { type: "string", enum: ["on", "off", "on_for"] },
      durationSec: {
        type: "integer",
        minimum: 1,
        maximum: 86400,
        description: "Required when mode = on_for",
      },
    },
  },

  // ── Water Now ────────────────────────────────────────────────────────────
  WaterNowRequest: {
    type: "object",
    required: ["waterMl"],
    properties: {
      waterMl: {
        type: "integer",
        minimum: 1,
        maximum: 5000,
        example: 200,
      },
    },
  },

  // ── Perenual autocomplete ─────────────────────────────────────────────────
  PerenualResult: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string", example: "Monstera deliciosa (Swiss cheese plant)" },
      image: nullable({ type: "string" }),
    },
  },

  // ── Device Config ─────────────────────────────────────────────────────────
  DeviceConfig: {
    type: "object",
    properties: {
      claimed: { type: "boolean" },
      deviceId: { type: "string", format: "uuid" },
      displayName: { type: "string" },
      channelsCount: { type: "integer" },
      supportsPumps: { type: "boolean" },
      supportsLight: { type: "boolean" },
      firmwareVersion: nullable({ type: "string" }),
      channels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            channel: { type: "integer" },
            plantId: { type: "string", format: "uuid" },
            plantName: { type: "string" },
            autoWatering: { type: "boolean" },
            autoLight: { type: "boolean" },
          },
        },
      },
      config: {
        type: "object",
        properties: {
          measurementIntervalSec: { type: "integer", example: 300 },
          commandPollIntervalSec: { type: "integer", example: 60 },
        },
      },
    },
  },
};

