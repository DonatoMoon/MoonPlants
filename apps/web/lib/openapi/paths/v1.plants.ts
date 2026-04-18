// lib/openapi/paths/v1.plants.ts
// OpenAPI path definitions for /api/v1/plants/**

import type { OpenAPIV3_1 } from "openapi-types";

const bearerSecurity = [{ BearerAuth: [] }];
const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };

export const v1PlantPaths: OpenAPIV3_1.PathsObject = {
  "/api/v1/plants": {
    post: {
      tags: ["Plants"],
      summary: "Create a plant",
      description:
        "Creates a new plant and optionally links it to a device channel. " +
        "If a Perenual ID is supplied, species data and image are auto-fetched.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreatePlantRequest" },
            examples: {
              withDevice: {
                summary: "Plant linked to device channel 1",
                value: {
                  deviceId: "e2a3b1c4-0000-0000-0000-000000000001",
                  soilChannel: 1,
                  name: "My Monstera",
                  speciesName: "Monstera deliciosa",
                  perenualId: 1882,
                  potVolumeMl: 3000,
                },
              },
              standalone: {
                summary: "Standalone plant without device",
                value: {
                  name: "Cactus",
                  speciesName: "Echinocactus grusonii",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Plant created",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { plant: { $ref: "#/components/schemas/Plant" } },
              },
            },
          },
        },
        "400": { description: "Invalid input or channel out of range", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "403": { description: "Device not owned by user", content: { "application/json": { schema: errorSchema } } },
        "409": { description: "Channel already in use", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/{plantId}": {
    get: {
      tags: ["Plants"],
      summary: "Get plant details",
      description:
        "Returns plant info, its linked species cache, latest measurement, and latest prediction.",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Plant detail",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  plant: { $ref: "#/components/schemas/Plant" },
                  lastMeasurement: {
                    $ref: "#/components/schemas/Measurement",
                    nullable: true,
                  },
                  lastPrediction: {
                    $ref: "#/components/schemas/Prediction",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },

    delete: {
      tags: ["Plants"],
      summary: "Delete a plant",
      description:
        "Permanently deletes the plant and all related measurements, predictions, and watering events (CASCADE).",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Plant deleted",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { success: { type: "boolean" } },
              },
            },
          },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/{plantId}/measurements": {
    get: {
      tags: ["Plants"],
      summary: "Get plant measurements",
      description:
        "Returns time-series measurements for the plant. Supports optional ISO date range filtering.",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "from",
          in: "query",
          schema: { type: "string", format: "date-time" },
          description: "Start of time range (ISO 8601)",
        },
        {
          name: "to",
          in: "query",
          schema: { type: "string", format: "date-time" },
          description: "End of time range (ISO 8601)",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
          description: "Max records to return",
        },
      ],
      responses: {
        "200": {
          description: "Measurements list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  measurements: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Measurement" },
                  },
                },
              },
              examples: {
                success: {
                  summary: "Single measurement",
                  value: {
                    measurements: [
                      {
                        id: "meas-uuid-001",
                        soil_moisture_pct: 62.4,
                        soil_moisture_raw: 2450,
                        air_temp_c: 22.5,
                        air_humidity_pct: 55.0,
                        light_lux: 2400,
                        battery_v: 3.8,
                        measured_at: "2026-03-03T10:00:00Z",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/{plantId}/predictions": {
    get: {
      tags: ["Plants"],
      summary: "Get watering prediction",
      description:
        "Runs the rule-based prediction model and returns the next watering recommendation.",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Prediction result",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  prediction: { $ref: "#/components/schemas/Prediction" },
                },
              },
            },
          },
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/{plantId}/watering-events": {
    post: {
      tags: ["Plants"],
      summary: "Record manual watering",
      description: "Logs a manual watering event and updates last_watered_at on the plant.",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateWateringEventRequest" },
            examples: {
              basic: {
                summary: "200 ml watering now",
                value: { waterMl: 200 },
              },
              withNote: {
                summary: "Watering with note",
                value: {
                  waterMl: 150,
                  happenedAt: "2026-03-03T08:00:00Z",
                  note: "After repotting",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Watering event created",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { event: { $ref: "#/components/schemas/WateringEvent" } },
              },
            },
          },
        },
        "400": { description: "Invalid input", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/{plantId}/actions/water-now": {
    post: {
      tags: ["Plants"],
      summary: "Trigger automated watering",
      description:
        "Creates a PUMP_WATER device command. The system checks if watering is actually needed first. " +
        "Returns commandCreated: false with a warning if watering is not recommended.",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/WaterNowRequest" },
            examples: {
              waterNow: {
                summary: "Water 200 ml",
                value: { waterMl: 200 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Water command queued",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  commandId: { type: "string", format: "uuid" },
                  commandCreated: { type: "boolean" },
                  check: { type: "string" },
                },
              },
            },
          },
        },
        "200": {
          description: "Watering skipped (not needed) or deduplicated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  warning: { type: "string" },
                  commandCreated: { type: "boolean" },
                  commandId: { type: "string", nullable: true },
                  deduplicated: { type: "boolean", nullable: true },
                },
              },
            },
          },
        },
        "400": { description: "Plant not linked to device channel", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/disconnected": {
    get: {
      tags: ["Plants"],
      summary: "Get disconnected plants",
      description: "Returns a list of user's plants that are not currently linked to any device channel.",
      security: bearerSecurity,
      responses: {
        "200": {
          description: "List of disconnected plants",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  plants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        species_name: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },

  "/api/v1/plants/{plantId}/photo": {
    post: {
      tags: ["Plants"],
      summary: "Upload plant photo",
      description: "Uploads a new photo for the plant.",
      security: bearerSecurity,
      parameters: [
        {
          name: "plantId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                file: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Photo uploaded successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  source: { type: "string", enum: ["user"] }
                }
              }
            }
          }
        },
        "400": { description: "Invalid input or file", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "404": { description: "Plant not found", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },
};

