// app/api/v1/plants/[plantId]/actions/water-now/route.ts
// POST /api/v1/plants/:plantId/actions/water-now — створити команду поливу

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getUser";
import { waterNowSchema } from "@/lib/iot/schemas";
import { IoTService } from "@/lib/services/iot.service";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ plantId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

        try {
            const result = await IoTService.waterPlant(user.id, plantId, parsed.data.waterMl);

            if (result.warning) {
                return NextResponse.json(
                    { warning: result.warning, commandCreated: false },
                    { status: 200 }
                );
            }

            if (result.deduplicated) {
                 return NextResponse.json(
                    {
                        commandId: result.commandId,
                        status: result.status,
                        deduplicated: true
                    },
                    { status: 200 }
                );
            }

            return NextResponse.json(
                {
                    commandId: result.commandId,
                    commandCreated: true,
                    check: result.check
                },
                { status: 201 }
            );

        } catch (serviceErr: unknown) {
            const msg = serviceErr instanceof Error ? serviceErr.message : "Service error";

            if (msg.includes("not found")) {
                return NextResponse.json({ error: "Plant not found" }, { status: 404 });
            }
            if (msg.includes("not linked")) {
                return NextResponse.json({ error: "Plant not linked to a device channel" }, { status: 400 });
            }
            throw serviceErr; // rethrow to catch block below
        }

    } catch (err) {
        console.error("[POST /api/v1/plants/:id/actions/water-now]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}



