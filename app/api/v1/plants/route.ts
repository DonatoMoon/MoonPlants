// app/api/v1/plants/route.ts
// POST /api/v1/plants — створити рослину з прив'язкою до каналу

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";
import { createPlantSchema } from "@/lib/iot/schemas";
import { getOrCacheSpecies } from "@/lib/species/cache";
import type { Database } from "@/lib/supabase/database.types";

type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type SpeciesCacheRow = Database["public"]["Tables"]["species_cache"]["Row"];
type PlantInsert = Database["public"]["Tables"]["plants"]["Insert"];

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
        const supabase = createSupabaseAdmin();

        // 1. If device specified, verify ownership and channel availability
        if (data.deviceId) {
            const { data: deviceRaw } = await supabase
                .from("devices")
                .select("*")
                .eq("id", data.deviceId)
                .single();

            const device = deviceRaw as DeviceRow | null;

            if (!device || device.owner_user_id !== user.id) {
                return NextResponse.json(
                    { error: "Device not found or not owned by you" },
                    { status: 403 }
                );
            }

            if (device.status !== "claimed") {
                return NextResponse.json(
                    { error: "Device not claimed" },
                    { status: 400 }
                );
            }

            if (
                data.soilChannel &&
                (data.soilChannel < 1 || data.soilChannel > device.channels_count)
            ) {
                return NextResponse.json(
                    {
                        error: `Channel must be between 1 and ${device.channels_count}`,
                    },
                    { status: 400 }
                );
            }

            // Check channel not already taken
            if (data.soilChannel) {
                const { data: existing } = await supabase
                    .from("plants")
                    .select("id")
                    .eq("device_id", data.deviceId)
                    .eq("soil_channel", data.soilChannel)
                    .maybeSingle();

                if (existing) {
                    return NextResponse.json(
                        { error: `Channel ${data.soilChannel} is already in use` },
                        { status: 409 }
                    );
                }
            }
        }

        // 2. Species cache + image
        let speciesCacheId: string | null = null;
        let imageUrl: string | null = null;
        let imageSource: "user" | "perenual" | "none" = "none";

        if (data.perenualId) {
            try {
                const species = (await getOrCacheSpecies(data.perenualId)) as SpeciesCacheRow | null;
                if (species) {
                    speciesCacheId = species.id;
                    if (species.default_image_url) {
                        imageUrl = species.default_image_url;
                        imageSource = "perenual";
                    }
                }
            } catch (err) {
                console.warn("[addPlant] Species cache failed:", err);
            }
        }

        // 3. Insert plant
        const insertData: PlantInsert = {
            owner_user_id: user.id,
            device_id: data.deviceId || null,
            soil_channel: data.soilChannel || null,
            name: data.name,
            species_name: data.speciesName,
            species_cache_id: speciesCacheId,
            image_url: imageUrl,
            image_source: imageSource,
            pot_volume_ml: data.potVolumeMl || null,
            pot_diameter_cm: data.potDiameterCm || null,
            pot_height_cm: data.potHeightCm || null,
            last_watered_at: data.lastWateredAt || null,
        };

        const { data: plant, error: insertErr } = await supabase
            .from("plants")
            .insert(insertData)
            .select()
            .single();

        if (insertErr) {
            return NextResponse.json(
                { error: insertErr.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ plant }, { status: 201 });
    } catch (err) {
        console.error("[POST /api/v1/plants]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
