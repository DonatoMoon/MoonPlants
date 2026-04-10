// app/api/v1/devices/[deviceId]/actions/unclaim/route.ts
// POST /api/v1/devices/:deviceId/actions/unclaim — від'єднання девайса від аккаунту

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getUser";
import { IoTService } from "@/lib/services/iot.service";

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { deviceId } = await params;

        await IoTService.unclaimDevice(user.id, deviceId);

        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        console.error("[POST /api/v1/devices/:id/actions/unclaim]", err);
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            { error: msg || "Internal server error" },
            { status: msg === "Device not found" ? 404 : 403 }
        );
    }
}
