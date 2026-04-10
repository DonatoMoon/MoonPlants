// app/api/iot/v1/device-config/route.ts
// GET /api/iot/v1/device-config — ESP32 отримує свою конфігурацію

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyIotDevice, isAuthError } from "@/lib/iot/auth";
import type { Database } from "@/lib/supabase/database.types";

type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type PlantRow = Database["public"]["Tables"]["plants"]["Row"];

export async function GET(req: NextRequest) {
    try {
        const authResult = await verifyIotDevice(req, "");
        if (isAuthError(authResult)) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { deviceId } = authResult;
        const supabase = createSupabaseAdmin();

        // 1. Get device info
        const { data: deviceRaw, error: deviceErr } = await supabase
            .from("devices")
            .select("*")
            .eq("id", deviceId)
            .single();

        const device = deviceRaw as DeviceRow | null;

        if (deviceErr || !device) {
            return NextResponse.json(
                { error: "Device not found" },
                { status: 404 }
            );
        }

        if (device.status !== "claimed") {
            return NextResponse.json({
                claimed: false,
                channelsCount: device.channels_count,
            });
        }

        // 2. Get channel → plant mapping
        const { data: plantsRaw } = await supabase
            .from("plants")
            .select("*")
            .eq("device_id", deviceId)
            .not("soil_channel", "is", null)
            .order("soil_channel", { ascending: true });

        const plants = (plantsRaw ?? []) as PlantRow[];

        const channelMapping = plants.map((p) => ({
            channel: p.soil_channel,
            plantId: p.id,
            plantName: p.name,
            autoWatering: p.auto_watering_enabled,
            autoLight: p.auto_light_enabled,
        }));

        return NextResponse.json({
            claimed: true,
            deviceId: device.id,
            displayName: device.display_name,
            channelsCount: device.channels_count,
            supportsPumps: device.supports_pumps,
            supportsLight: device.supports_light,
            firmwareVersion: device.firmware_version,
            channels: channelMapping,
            config: {
                measurementIntervalSec: 300,   // 5 хвилин
                commandPollIntervalSec: 60,    // 1 хвилина
            },
        });
    } catch (err) {
        console.error("[GET /api/iot/v1/device-config]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
