// lib/openapi/paths/v1.cron.ts
import type { OpenAPIV3_1 } from "openapi-types";

const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };

export const v1CronPaths: OpenAPIV3_1.PathsObject = {
  "/api/v1/cron/predict": {
    get: {
      tags: ["Utility"],
      summary: "Run batch predictions",
      description: "Triggers the batch prediction and auto-watering sequence. Secured via CRON_SECRET.",
      security: [{ BearerAuth: [] }],
      responses: {
        "200": {
          description: "Batch predictions ran successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  results: { type: "object", additionalProperties: true }
                }
              }
            }
          }
        },
        "401": { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      }
    }
  }
};
