// app/api/openapi.json/route.ts
// GET /api/openapi.json — returns the OpenAPI 3.1 spec as JSON

import { NextResponse } from "next/server";
import { getOpenApiSpec } from "@/lib/openapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const spec = getOpenApiSpec();
  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

