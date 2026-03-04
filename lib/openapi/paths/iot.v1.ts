// lib/openapi/paths/iot.v1.ts
// OpenAPI path definitions for /api/iot/v1/** (device-facing endpoints)
// Auth: HMAC-SHA256 via X-Device-* headers

import type { OpenAPIV3_1 } from "openapi-types";

const iotSecurity = [{ IotHmac: [] }];
const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };

const iotHeaders: OpenAPIV3_1.ParameterObject[] = [
  {
    name: "X-Device-Id",
    in: "header",
    required: true,
    schema: { type: "string", format: "uuid" },
    description: "Device UUID",
  },
  {
    name: "X-Device-Seq",
    in: "header",
    required: true,
    schema: { type: "integer" },
    description: "Monotonic sequence counter stored in flash",
  },
  {
    name: "X-Device-Timestamp",
    in: "header",
    required: true,
    schema: { type: "integer" },
    description: "Current Unix epoch seconds (must be within ±120s of server time)",
  },
  {
    name: "X-Content-SHA256",
    in: "header",
    required: true,
    schema: { type: "string" },
    description: "Hex SHA-256 of the request body (empty string for GET requests)",
  },
  {
    name: "X-Device-Signature",
    in: "header",
    required: true,
    schema: { type: "string" },
    description:
      "base64url(HMAC-SHA256(secret, canonical_string)) where canonical_string = METHOD\\nPATH\\nX-Device-Id\\nX-Device-Seq\\nX-Device-Timestamp\\nX-Content-SHA256",
  },
];

export const iotV1Paths: OpenAPIV3_1.PathsObject = {
  "/api/iot/v1/measurements": {
    post: {
      tags: ["IoT Device"],
      summary: "Submit sensor measurements",
      description:
        "ESP32 posts sensor data for all active channels. The server maps channels to plant_ids " +
        "and stores measurements. Uses upsert on (device_id, seq, plant_id) for idempotency.",
      security: iotSecurity,
      parameters: iotHeaders,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/IotMeasurementPayload" },
            examples: {
              twoChannels: {
                summary: "2-channel measurement with all sensors",
                value: {
                  measuredAt: 1709481600,
                  air: { tempC: 22.5, humidityPct: 55 },
                  lightLux: 2400,
                  soil: [
                    { channel: 1, moistureRaw: 2450 },
                    { channel: 2, moistureRaw: 3100 },
                  ],
                  batteryV: 3.8,
                  rssiDbm: -67,
                },
              },
              minimalPayload: {
                summary: "Minimal payload (soil only)",
                value: {
                  measuredAt: 1709481600,
                  soil: [{ channel: 1, moistureRaw: 2450 }],
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Measurements ingested",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ingested: { type: "integer", description: "Number of rows stored" },
                  ignoredChannels: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Channels with no linked plant",
                  },
                },
              },
            },
          },
        },
        "400": { description: "Invalid JSON or payload schema", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "HMAC auth failed or missing headers", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/iot/v1/commands": {
    get: {
      tags: ["IoT Device"],
      summary: "Poll pending commands",
      description:
        "Returns queued commands for this device (PUMP_WATER, LIGHT_ON, LIGHT_OFF). " +
        "Stale commands are expired automatically. Fetched commands are marked as 'sent'.",
      security: iotSecurity,
      parameters: [
        ...iotHeaders,
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          description: "Max commands to return",
        },
      ],
      responses: {
        "200": {
          description: "Pending commands list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  commands: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        type: { type: "string", enum: ["PUMP_WATER", "LIGHT_ON", "LIGHT_OFF"] },
                        payload: { type: "object", additionalProperties: true },
                      },
                    },
                  },
                },
              },
              examples: {
                pumpCommand: {
                  summary: "Pump water command",
                  value: {
                    commands: [
                      {
                        id: "cmd-uuid-001",
                        type: "PUMP_WATER",
                        payload: { channel: 1, water_ml: 200, max_duration_sec: 40 },
                      },
                    ],
                  },
                },
                empty: {
                  summary: "No pending commands",
                  value: { commands: [] },
                },
              },
            },
          },
        },
        "401": { description: "HMAC auth failed", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/iot/v1/commands/{commandId}/ack": {
    post: {
      tags: ["IoT Device"],
      summary: "Acknowledge command execution",
      description:
        "Device reports whether a command succeeded or failed. " +
        "On successful PUMP_WATER ack, a watering_event is auto-created.",
      security: iotSecurity,
      parameters: [
        ...iotHeaders,
        {
          name: "commandId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CommandAckPayload" },
            examples: {
              success: {
                summary: "Command succeeded",
                value: { status: "ok", executedAt: 1709481700 },
              },
              failed: {
                summary: "Command failed",
                value: {
                  status: "failed",
                  executedAt: 1709481700,
                  result: { error: "pump_jam" },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Ack received",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  alreadyAcked: { type: "boolean" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid payload", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "HMAC auth failed", content: { "application/json": { schema: errorSchema } } },
        "403": { description: "Command belongs to different device", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Command not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/iot/v1/device-config": {
    get: {
      tags: ["IoT Device"],
      summary: "Get device configuration",
      description:
        "Returns the device's current configuration: claimed status, channel→plant mapping, " +
        "measurement and command-poll intervals.",
      security: iotSecurity,
      parameters: iotHeaders,
      responses: {
        "200": {
          description: "Device configuration",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DeviceConfig" },
              examples: {
                claimed: {
                  summary: "Claimed device with 2 channels",
                  value: {
                    claimed: true,
                    deviceId: "e2a3b1c4-0000-0000-0000-000000000001",
                    displayName: "Balcony Hub",
                    channelsCount: 4,
                    supportsPumps: true,
                    supportsLight: true,
                    firmwareVersion: "1.2.0",
                    channels: [
                      { channel: 1, plantId: "plant-uuid-001", plantName: "Monstera", autoWatering: false, autoLight: false },
                    ],
                    config: { measurementIntervalSec: 300, commandPollIntervalSec: 60 },
                  },
                },
                unclaimed: {
                  summary: "Unclaimed device",
                  value: { claimed: false, channelsCount: 4 },
                },
              },
            },
          },
        },
        "401": { description: "HMAC auth failed", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Device not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },
};

