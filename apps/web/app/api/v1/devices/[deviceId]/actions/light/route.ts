// app/api/v1/devices/[deviceId]/actions/light/route.ts
// POST /api/v1/devices/:deviceId/actions/light — керування лампою

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";
import { lightCommandSchema } from "@/lib/iot/schemas";
import type { Database } from "@/lib/supabase/database.types";

type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type CommandRow = Database["public"]["Tables"]["device_commands"]["Row"];
type CommandInsert = Database["public"]["Tables"]["device_commands"]["Insert"];

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
        const parsed = lightCommandSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = createSupabaseAdmin();

        // Verify ownership
        const { data: deviceRaw } = await supabase
            .from("devices")
            .select("*")
            .eq("id", deviceId)
            .eq("owner_user_id", user.id)
            .single();

        const device = deviceRaw as DeviceRow | null;

        if (!device) {
            return NextResponse.json(
                { error: "Device not found" },
                { status: 404 }
            );
        }

        if (!device.supports_light) {
            return NextResponse.json(
                { error: "Device does not support light control" },
                { status: 400 }
            );
        }

        // Check for conflicting light command
        const { data: activeCmdRaw } = await supabase
            .from("device_commands")
            .select("*")
            .eq("device_id", deviceId)
            .in("type", ["LIGHT_ON", "LIGHT_OFF"])
            .in("status", ["queued", "sent"])
            .maybeSingle();

        const activeCmd = activeCmdRaw as CommandRow | null;

        if (activeCmd) {
            return NextResponse.json(
                {
                    error: "Active light command already exists",
                    existingCommandId: activeCmd.id,
                },
                { status: 409 }
            );
        }

        // Determine command type and payload
        const { mode, durationSec } = parsed.data;
        let cmdType: "LIGHT_ON" | "LIGHT_OFF";
        const payload: { [key: string]: string | number | boolean | null } = {};

        if (mode === "off") {
            cmdType = "LIGHT_OFF";
        } else {
            cmdType = "LIGHT_ON";
            if (mode === "on_for" && durationSec) {
                payload.duration_sec = durationSec;
            }
        }

        const idempotencyKey = `light:${deviceId}:${mode}:${Math.floor(Date.now() / 60000)}`;

        const insertData: CommandInsert = {
            device_id: deviceId,
            type: cmdType,
            payload,
            status: "queued",
            send_after: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            idempotency_key: idempotencyKey,
        };

        const { data: commandRaw, error } = await supabase
            .from("device_commands")
            .insert(insertData)
            .select()
            .single();

        const command = commandRaw as CommandRow | null;

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json(
                    { error: "Duplicate command", deduplicated: true },
                    { status: 200 }
                );
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ commandId: command?.id }, { status: 201 });
    } catch (err) {
        console.error("[POST /api/v1/devices/:id/actions/light]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

