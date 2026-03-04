// app/api/v1/plants/[plantId]/actions/water-now/route.ts
// POST /api/v1/plants/:plantId/actions/water-now — створити команду поливу

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";
import { waterNowSchema } from "@/lib/iot/schemas";
import { doubleCheckBeforeWatering } from "@/lib/predictions/rule-based";
import type { Database } from "@/lib/supabase/database.types";

type PlantRow = Database["public"]["Tables"]["plants"]["Row"];
type CommandRow = Database["public"]["Tables"]["device_commands"]["Row"];
type CommandInsert = Database["public"]["Tables"]["device_commands"]["Insert"];

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

        const supabase = createSupabaseAdmin();

        // Verify ownership and get device + channel
        const { data: plantRaw } = await supabase
            .from("plants")
            .select("*")
            .eq("id", plantId)
            .eq("owner_user_id", user.id)
            .single();

        const plant = plantRaw as PlantRow | null;

        if (!plant) {
            return NextResponse.json(
                { error: "Plant not found" },
                { status: 404 }
            );
        }

        if (!plant.device_id || !plant.soil_channel) {
            return NextResponse.json(
                { error: "Plant not linked to a device channel" },
                { status: 400 }
            );
        }

        // Double-check before watering
        const check = await doubleCheckBeforeWatering(plantId);
        if (!check.shouldWater) {
            return NextResponse.json(
                { warning: check.reason, commandCreated: false },
                { status: 200 }
            );
        }

        // Idempotency key: manual:<plantId>:<timestamp_rounded_to_5min>
        const roundedTs = Math.floor(Date.now() / (5 * 60 * 1000));
        const idempotencyKey = `manual:${plantId}:${roundedTs}`;

        // Check for existing command with same idempotency key
        const { data: existingCmdRaw } = await supabase
            .from("device_commands")
            .select("*")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();

        const existingCmd = existingCmdRaw as CommandRow | null;

        if (existingCmd) {
            return NextResponse.json(
                { commandId: existingCmd.id, status: existingCmd.status, deduplicated: true },
                { status: 200 }
            );
        }

        // Create command
        const insertData: CommandInsert = {
            device_id: plant.device_id,
            type: "PUMP_WATER",
            payload: {
                channel: plant.soil_channel,
                water_ml: parsed.data.waterMl,
                max_duration_sec: Math.ceil(parsed.data.waterMl / 5),
            },
            status: "queued",
            send_after: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            idempotency_key: idempotencyKey,
        };

        const { data: commandRaw, error } = await supabase
            .from("device_commands")
            .insert(insertData)
            .select()
            .single();

        const command = commandRaw as CommandRow | null;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(
            { commandId: command?.id, commandCreated: true, check: check.reason },
            { status: 201 }
        );
    } catch (err) {
        console.error("[POST /api/v1/plants/:id/actions/water-now]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
