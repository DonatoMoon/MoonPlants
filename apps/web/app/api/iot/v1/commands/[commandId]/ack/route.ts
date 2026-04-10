// app/api/iot/v1/commands/[commandId]/ack/route.ts
// POST /api/iot/v1/commands/:commandId/ack — ESP32 підтверджує виконання команди

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyIotDevice, isAuthError } from "@/lib/iot/auth";
import { commandAckPayloadSchema } from "@/lib/iot/schemas";
import type { Database } from "@/lib/supabase/database.types";

type CommandRow = Database["public"]["Tables"]["device_commands"]["Row"];
type CommandUpdate = Database["public"]["Tables"]["device_commands"]["Update"];
type PlantRow = Database["public"]["Tables"]["plants"]["Row"];
type PlantUpdate = Database["public"]["Tables"]["plants"]["Update"];
type WateringEventInsert = Database["public"]["Tables"]["watering_events"]["Insert"];

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ commandId: string }> }
) {
    try {
        const bodyText = await req.text();

        // 1. Device auth
        const authResult = await verifyIotDevice(req, bodyText);
        if (isAuthError(authResult)) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { deviceId } = authResult;
        const { commandId } = await params;

        // 2. Parse body
        let body: unknown;
        try {
            body = JSON.parse(bodyText);
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON" },
                { status: 400 }
            );
        }

        const parsed = commandAckPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid payload", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = createSupabaseAdmin();

        // 3. Find command — must belong to this device
        const { data: commandRaw, error: cmdErr } = await supabase
            .from("device_commands")
            .select("*")
            .eq("id", commandId)
            .single();

        const command = commandRaw as CommandRow | null;

        if (cmdErr || !command) {
            return NextResponse.json(
                { error: "Command not found" },
                { status: 404 }
            );
        }

        if (command.device_id !== deviceId) {
            return NextResponse.json(
                { error: "Command does not belong to this device" },
                { status: 403 }
            );
        }

        // 4. Idempotent: if already acked, just return ok
        if (command.status === "acked") {
            return NextResponse.json({ ok: true, alreadyAcked: true });
        }

        // 5. Update command status
        const newStatus = parsed.data.status === "ok" ? "acked" : "failed";
        const ackedAt = parsed.data.executedAt
            ? new Date(parsed.data.executedAt * 1000).toISOString()
            : new Date().toISOString();

        await supabase
            .from("device_commands")
            .update({
                status: newStatus,
                acked_at: ackedAt,
                result: parsed.data.result || null,
            } as CommandUpdate)
            .eq("id", commandId);

        // 6. If PUMP_WATER was successful — record watering event & update plant
        if (
            command.type === "PUMP_WATER" &&
            parsed.data.status === "ok"
        ) {
            const payload = command.payload as {
                channel?: number;
                water_ml?: number;
            };

            if (payload.channel) {
                // Find plant by device + channel
                const { data: plantRaw } = await supabase
                    .from("plants")
                    .select("*")
                    .eq("device_id", deviceId)
                    .eq("soil_channel", payload.channel)
                    .maybeSingle();

                const plant = plantRaw as PlantRow | null;

                if (plant) {
                    // Insert watering event
                    const eventInsert: WateringEventInsert = {
                        plant_id: plant.id,
                        source: "command",
                        water_ml: payload.water_ml || null,
                        happened_at: ackedAt,
                    };
                    await supabase.from("watering_events").insert(eventInsert);

                    // Update last_watered_at
                    await supabase
                        .from("plants")
                        .update({ last_watered_at: ackedAt } as PlantUpdate)
                        .eq("id", plant.id);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[POST /api/iot/v1/commands/:id/ack]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
