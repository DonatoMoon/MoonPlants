// app/api/v1/devices/[deviceId]/actions/swap-channels/route.ts
// POST /api/v1/devices/:deviceId/actions/swap-channels — міняємо рослини каналами

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getUser";
import { IoTService } from "@/lib/services/iot.service";
import { swapChannelsSchema } from "@/lib/iot/schemas";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { deviceId } = await params;
        const body = await req.json();
        
        const parsed = swapChannelsSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { plantId1, plantId2 } = parsed.data;

        await IoTService.swapChannels(user.id, deviceId, plantId1, plantId2);

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        console.error("[POST /api/v1/devices/:id/actions/swap-channels]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 400 }
        );
    }
}
