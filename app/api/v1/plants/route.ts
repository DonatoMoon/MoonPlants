// app/api/v1/plants/route.ts
// POST /api/v1/plants — створити рослину з прив'язкою до каналу

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getUser";
import { createPlantSchema } from "@/lib/iot/schemas";
import { PlantsService } from "@/lib/services/plants.service";

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = createPlantSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const data = parsed.data;

        const plant = await PlantsService.addPlant({
            userId: user.id,
            name: data.name,
            speciesName: data.speciesName,
            perenualId: data.perenualId,
            deviceId: data.deviceId,
            soilChannel: data.soilChannel,
            potVolumeMl: data.potVolumeMl,
            potDiameterCm: data.potDiameterCm,
            potHeightCm: data.potHeightCm,
            lastWateredAt: data.lastWateredAt ? new Date(data.lastWateredAt) : null,
        });

        return NextResponse.json({ plant }, { status: 201 });
    } catch (err: unknown) {
        console.error("[POST /api/v1/plants]", err);
        
        let status = 500;
        const msg = err instanceof Error ? err.message : "Internal server error";

        if (msg.includes("not found") || msg.includes("not owned by you")) status = 403;
        else if (msg.includes("already in use")) status = 409;
        else if (msg.includes("Channel must be") || msg.includes("not claimed")) status = 400;

        return NextResponse.json({ error: msg }, { status });
    }
}
