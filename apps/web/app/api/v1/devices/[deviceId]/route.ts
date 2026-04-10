// app/api/v1/devices/[deviceId]/route.ts
// GET /api/v1/devices/:deviceId — деталі девайса з рослинами

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { deviceId } = await params;
        const supabase = createSupabaseAdmin();

        // Device
        const { data: device, error: deviceErr } = await supabase
            .from("devices")
            .select(
                "id, display_name, channels_count, supports_pumps, supports_light, firmware_version, status, last_seen_at, created_at"
            )
            .eq("id", deviceId)
            .eq("owner_user_id", user.id)
            .single();

        if (deviceErr || !device) {
            return NextResponse.json(
                { error: "Device not found" },
                { status: 404 }
            );
        }

        // Plants linked to this device
        const { data: plants } = await supabase
            .from("plants")
            .select(
                "id, name, species_name, soil_channel, image_url, auto_watering_enabled, auto_light_enabled"
            )
            .eq("device_id", deviceId)
            .order("soil_channel", { ascending: true });

        // Pending commands
        const { data: pendingCommands } = await supabase
            .from("device_commands")
            .select("id, type, payload, status, created_at, send_after, expires_at")
            .eq("device_id", deviceId)
            .in("status", ["queued", "sent"])
            .order("created_at", { ascending: false })
            .limit(20);

        return NextResponse.json({
            device,
            plants: plants ?? [],
            pendingCommands: pendingCommands ?? [],
        });
    } catch (err) {
        console.error("[GET /api/v1/devices/:id]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

