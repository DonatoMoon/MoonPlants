// lib/openapi/paths/misc.ts
// OpenAPI path definitions for miscellaneous endpoints

import type { OpenAPIV3_1 } from "openapi-types";

const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };

export const miscPaths: OpenAPIV3_1.PathsObject = {
  "/api/perenual-autocomplete": {
    get: {
      tags: ["Utility"],
      summary: "Autocomplete plant species",
      description:
        "Searches the Perenual API for plant species by name. Returns a list of matches " +
        "with ID, display name, and thumbnail image URL.",
      parameters: [
        {
          name: "q",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 1 },
          description: "Search query string",
          example: "monstera",
        },
      ],
      responses: {
        "200": {
          description: "Autocomplete results",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/PerenualResult" },
                  },
                },
              },
              examples: {
                monstera: {
                  summary: "Results for 'monstera'",
                  value: {
                    data: [
                      {
                        id: 1882,
                        name: "Monstera deliciosa (Swiss cheese plant)",
                        image: "https://perenual.com/storage/species_img/1882/small/1882.jpg",
                      },
                    ],
                  },
                },
                empty: {
                  summary: "No query – empty result",
                  value: { data: [] },
                },
              },
            },
          },
        },
        "500": { description: "Server error", content: { "application/json": { schema: errorSchema } } },
      },
    },
  },
};

