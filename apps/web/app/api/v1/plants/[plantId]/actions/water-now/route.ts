// app/api/v1/plants/[plantId]/actions/water-now/route.ts
// POST /api/v1/plants/:plantId/actions/water-now — створити команду поливу

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getUser";
import { waterNowSchema } from "@/lib/iot/schemas";
import { IoTService } from "@/lib/services/iot.service";
import { errorResponse, AppError } from "@/lib/errors";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ plantId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rl = rateLimit(`water:${user.id}`, RATE_LIMIT, WINDOW_MS);
        if (!rl.ok) {
            return NextResponse.json(
                { error: "Too many requests", code: "rate_limited" },
                { status: 429, headers: rateLimitHeaders(rl, RATE_LIMIT) }
            );
        }

        const { plantId } = await params;
        const body = await req.json();
        const parsed = waterNowSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const result = await IoTService.waterPlant(user.id, plantId, parsed.data.waterMl);

        if (result.warning) {
            return NextResponse.json(
                { warning: result.warning, commandCreated: false },
                { status: 200 }
            );
        }

        if (result.deduplicated) {
            return NextResponse.json(
                { commandId: result.commandId, status: result.status, deduplicated: true },
                { status: 200 }
            );
        }

        return NextResponse.json(
            { commandId: result.commandId, commandCreated: true, check: result.check },
            { status: 201 }
        );
    } catch (err) {
        if (err instanceof Error) {
            const msg = err.message;
            if (msg.includes("not found") || msg.includes("unauthorized")) {
                return errorResponse(new AppError('not_found', 'Plant not found', 404));
            }
            if (msg.includes("not linked")) {
                return errorResponse(new AppError('validation', 'Plant not linked to a device channel', 400));
            }
        }
        return errorResponse(err);
    }
}
