// app/api/iot/v1/measurements/route.ts
// POST /api/iot/v1/measurements — прийом даних з ESP32

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyIotDevice, isAuthError } from "@/lib/iot/auth";
import { iotMeasurementPayloadSchema } from "@/lib/iot/schemas";
import type { Database } from "@/lib/supabase/database.types";

type PlantRow = Database["public"]["Tables"]["plants"]["Row"];
type MeasurementInsert = Database["public"]["Tables"]["measurements"]["Insert"];

export async function POST(req: NextRequest) {
    try {
        // 1. Read body
        const bodyText = await req.text();

        // 2. Device authentication (HMAC)
        const authResult = await verifyIotDevice(req, bodyText);
        if (isAuthError(authResult)) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { deviceId, seq } = authResult;

        // 3. Parse and validate payload
        let body: unknown;
        try {
            body = JSON.parse(bodyText);
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON" },
                { status: 400 }
            );
        }

        const parsed = iotMeasurementPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid payload", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const supabase = createSupabaseAdmin();

        // 4. Get all plants linked to this device (channel → plant_id mapping)
        const { data: plantsRaw } = await supabase
            .from("plants")
            .select("*")
            .eq("device_id", deviceId)
            .not("soil_channel", "is", null);

        const plants = (plantsRaw ?? []) as PlantRow[];

        const channelMap = new Map<number, string>();
        for (const p of plants) {
            if (p.soil_channel != null) {
                channelMap.set(p.soil_channel, p.id);
            }
        }

        // 5. Build measurement rows
        const measuredAt = new Date(data.measuredAt * 1000).toISOString();
        const rows: MeasurementInsert[] = [];
        const ignoredChannels: number[] = [];

        for (const soil of data.soil) {
            const plantId = channelMap.get(soil.channel);
            if (!plantId) {
                ignoredChannels.push(soil.channel);
                continue;
            }

            rows.push({
                plant_id: plantId,
                device_id: deviceId,
                soil_moisture_raw: soil.moistureRaw,
                air_temp_c: data.air?.tempC ?? null,
                air_humidity_pct: data.air?.humidityPct ?? null,
                light_lux: data.lightLux ?? null,
                battery_v: data.batteryV ?? null,
                rssi_dbm: data.rssiDbm ?? null,
                seq,
                measured_at: measuredAt,
            });
        }

        // 6. Insert with ON CONFLICT for idempotency
        let ingested = 0;
        if (rows.length > 0) {
            // Use upsert: if (device_id, seq, plant_id) already exists → skip
            const { data: inserted, error } = await supabase
                .from("measurements")
                .upsert(rows, {
                    onConflict: "device_id,seq,plant_id",
                    ignoreDuplicates: true,
                })
                .select("id");

            if (error) {
                console.error("[IoT measurements] Insert error:", error);
                return NextResponse.json(
                    { error: "Failed to insert measurements" },
                    { status: 500 }
                );
            }

            ingested = inserted?.length ?? rows.length;
        }

        return NextResponse.json({
            ok: true,
            ingested,
            ignoredChannels,
        });
    } catch (err) {
        console.error("[POST /api/iot/v1/measurements]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
