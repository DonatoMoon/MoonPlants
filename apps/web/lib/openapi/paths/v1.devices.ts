// lib/openapi/paths/v1.devices.ts
// OpenAPI path definitions for /api/v1/devices/**

import type { OpenAPIV3_1 } from "openapi-types";

const bearerSecurity = [{ BearerAuth: [] }];

const deviceSchema = { $ref: "#/components/schemas/Device" };
const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };

export const v1DevicePaths: OpenAPIV3_1.PathsObject = {
  "/api/v1/devices": {
    get: {
      tags: ["Devices"],
      summary: "List user devices",
      description:
        "Returns all claimed devices owned by the authenticated user.",
      security: bearerSecurity,
      responses: {
        "200": {
          description: "List of devices",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  devices: { type: "array", items: deviceSchema },
                },
              },
              examples: {
                success: {
                  summary: "Two devices returned",
                  value: {
                    devices: [
                      {
                        id: "e2a3b1c4-0000-0000-0000-000000000001",
                        display_name: "Balcony Hub",
                        channels_count: 4,
                        supports_pumps: true,
                        supports_light: true,
                        firmware_version: "1.2.0",
                        status: "claimed",
                        last_seen_at: "2026-03-03T10:00:00Z",
                        created_at: "2026-01-01T00:00:00Z",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/devices/{deviceId}": {
    get: {
      tags: ["Devices"],
      summary: "Get device details",
      description:
        "Returns device info, linked plants, and pending commands.",
      security: bearerSecurity,
      parameters: [
        {
          name: "deviceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Device detail",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DeviceDetail" },
              examples: {
                success: {
                  summary: "Device with one plant",
                  value: {
                    device: {
                      id: "e2a3b1c4-0000-0000-0000-000000000001",
                      display_name: "Balcony Hub",
                      channels_count: 4,
                      supports_pumps: true,
                      supports_light: true,
                      firmware_version: "1.2.0",
                      status: "claimed",
                      last_seen_at: "2026-03-03T10:00:00Z",
                      created_at: "2026-01-01T00:00:00Z",
                    },
                    plants: [
                      {
                        id: "plant-uuid-001",
                        name: "Monstera",
                        species_name: "Monstera deliciosa",
                        soil_channel: 1,
                        image_url: null,
                        auto_watering_enabled: false,
                        auto_light_enabled: false,
                      },
                    ],
                    pendingCommands: [],
                  },
                },
              },
            },
          },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Device not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/devices/claim": {
    post: {
      tags: ["Devices"],
      summary: "Claim a device",
      description:
        "Links an unclaimed device to the authenticated user's account using the device's claim code.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ClaimDeviceRequest" },
            examples: {
              claim: {
                summary: "Claim with valid code",
                value: {
                  deviceId: "e2a3b1c4-0000-0000-0000-000000000001",
                  claimCode: "CLAIM-ABCD-EFGH-IJKL",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Device claimed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  deviceId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid input", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Device not found", content: { "application/json": { schema: errorSchema } } },
        "409": { description: "Device already claimed", content: { "application/json": { schema: errorSchema } } },
        "429": {
          description: "Too many failed attempts",
          content: { "application/json": { schema: errorSchema } },
        },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/devices/{deviceId}/actions/light": {
    post: {
      tags: ["Devices"],
      summary: "Send light command",
      description:
        "Queues a LIGHT_ON or LIGHT_OFF command for the device. The device picks it up on next poll.",
      security: bearerSecurity,
      parameters: [
        {
          name: "deviceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/LightCommandRequest" },
            examples: {
              turnOn: {
                summary: "Turn light on for 2 hours",
                value: { mode: "on_for", durationSec: 7200 },
              },
              turnOff: {
                summary: "Turn light off",
                value: { mode: "off" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Command queued",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { commandId: { type: "string", format: "uuid" } },
              },
            },
          },
        },
        "200": {
          description: "Duplicate command (deduplicated)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string" },
                  deduplicated: { type: "boolean" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid input or device does not support light", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Device not found", content: { "application/json": { schema: errorSchema } } },
        "409": { description: "Active light command already exists", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/devices/{deviceId}/actions/swap-channels": {
    post: {
      tags: ["Devices"],
      summary: "Swap channels between two plants",
      description: "Swaps the linked device channels for two plants belonging to this device.",
      security: bearerSecurity,
      parameters: [
        {
          name: "deviceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["plantId1", "plantId2"],
              properties: {
                plantId1: { type: "string", format: "uuid" },
                plantId2: { type: "string", format: "uuid" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Channels swapped successfully",
          content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } },
        },
        "400": { description: "Invalid input", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/devices/{deviceId}/actions/unclaim": {
    post: {
      tags: ["Devices"],
      summary: "Unclaim device",
      description: "Unlinks the device from the user's account.",
      security: bearerSecurity,
      parameters: [
        {
          name: "deviceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Device unclaimed successfully",
          content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "403": { description: "Forbidden", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Device not found", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },
};

