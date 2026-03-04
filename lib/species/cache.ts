// lib/species/cache.ts
// Кеш видів рослин: Perenual API → Supabase Storage + species_cache table

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

const PERENUAL_BASE = "https://perenual.com/api/v2";

type PerenualDetail = {
    id: number;
    common_name?: string;
    scientific_name?: string[];
    family?: string;
    type?: string;
    watering?: string;
    sunlight?: string[];
    indoor?: boolean;
    cycle?: string;
    default_image?: {
        original_url?: string;
        medium_url?: string;
        small_url?: string;
    };
    [key: string]: unknown;
};

/**
 * Get or create species cache entry.
 * Fetches from Perenual if not cached, downloads image to Supabase Storage.
 */
export async function getOrCacheSpecies(perenualId: number) {
    const supabase = createSupabaseAdmin();

    // 1. Check cache
    const { data: existing } = await supabase
        .from("species_cache")
        .select("*")
        .eq("perenual_id", perenualId)
        .single();

    if (existing) return existing;

    // 2. Fetch from Perenual
    const apiKey = process.env.PERENUAL_API_KEY;
    if (!apiKey) throw new Error("Missing PERENUAL_API_KEY");

    const res = await fetch(
        `${PERENUAL_BASE}/species/details/${perenualId}?key=${apiKey}`
    );
    if (!res.ok) {
        throw new Error(`Perenual API error: ${res.status}`);
    }

    const detail: PerenualDetail = await res.json();

    // 3. Download image to Supabase Storage
    let defaultImageUrl: string | null = null;
    const imageUrl =
        detail.default_image?.medium_url ||
        detail.default_image?.original_url ||
        detail.default_image?.small_url;

    if (imageUrl && !imageUrl.includes("upgrade_access")) {
        try {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
                const imgBuffer = await imgRes.arrayBuffer();
                const contentType =
                    imgRes.headers.get("content-type") || "image/jpeg";
                const ext = contentType.includes("png") ? "png" : "jpg";
                const storagePath = `species/${perenualId}/default.${ext}`;

                const { error: uploadErr } = await supabase.storage
                    .from("plants")
                    .upload(storagePath, imgBuffer, {
                        contentType,
                        upsert: true,
                    });

                if (!uploadErr) {
                    defaultImageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plants/${storagePath}`;
                }
            }
        } catch {
            // Image download failed — continue without image
            console.warn(
                `Failed to cache image for species ${perenualId}`
            );
        }
    }

    // 4. Insert into species_cache
    const row = {
        perenual_id: perenualId,
        common_name: detail.common_name || null,
        scientific_name: (detail.scientific_name || null) as Json,
        family: detail.family || null,
        type: detail.type || null,
        watering: detail.watering || null,
        sunlight: (detail.sunlight || null) as Json,
        indoor: detail.indoor ?? null,
        cycle: detail.cycle || null,
        default_image_url: defaultImageUrl,
        raw_json: detail as unknown as Json,
    };

    const { data: inserted, error: insertErr } = await supabase
        .from("species_cache")
        .insert(row)
        .select()
        .single();

    if (insertErr) {
        // Possible race condition: another request already inserted
        const { data: fallback } = await supabase
            .from("species_cache")
            .select("*")
            .eq("perenual_id", perenualId)
            .single();
        return fallback;
    }

    return inserted;
}



