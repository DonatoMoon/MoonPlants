// lib/predictions/rule-based.ts
// Rule-based prediction для наступного поливу
// Model: "rulebased_v1"

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

type PlantRow = Database["public"]["Tables"]["plants"]["Row"];
type MeasurementRow = Database["public"]["Tables"]["measurements"]["Row"];
type SpeciesCacheRow = Database["public"]["Tables"]["species_cache"]["Row"];
type WateringEventRow = Database["public"]["Tables"]["watering_events"]["Row"];
type PredictionInsert = Database["public"]["Tables"]["predictions"]["Insert"];

type PlantWithSpecies = PlantRow & {
    species_cache: SpeciesCacheRow | null;
};

type PredictionResult = {
    nextWateringAt: string | null;
    recommendedWaterMl: number | null;
    confidence: number;
    details: Record<string, unknown>;
};

/**
 * Predict next watering for a plant.
 * Uses last N measurements to compute depletion rate.
 * Accounts for pot volume, temperature, and species watering needs.
 */
export async function predictNextWatering(
    plantId: string
): Promise<PredictionResult> {
    const supabase = createSupabaseAdmin();

    // 1. Fetch plant info
    const { data: plantRaw } = await supabase
        .from("plants")
        .select("*, species_cache:species_cache_id(*)")
        .eq("id", plantId)
        .single();

    const plant = plantRaw as PlantWithSpecies | null;
    if (!plant) throw new Error("Plant not found");

    // 2. Fetch last 50 measurements
    const { data: measurementsRaw } = await supabase
        .from("measurements")
        .select("*")
        .eq("plant_id", plantId)
        .order("measured_at", { ascending: false })
        .limit(50);

    const measurements = (measurementsRaw ?? []) as MeasurementRow[];

    if (measurements.length < 2) {
        return {
            nextWateringAt: null,
            recommendedWaterMl: null,
            confidence: 0,
            details: { reason: "Not enough measurements (need ≥ 2)" },
        };
    }

    // 3. Compute moisture depletion rate (%/hour)
    const latest = measurements[0];
    const oldest = measurements[measurements.length - 1];

    const latestMoisture = Number(latest.soil_moisture_pct) || 0;
    const oldestMoisture = Number(oldest.soil_moisture_pct) || 0;

    const hoursDiff =
        (new Date(latest.measured_at).getTime() -
            new Date(oldest.measured_at).getTime()) /
        (1000 * 60 * 60);

    const depletionRate =
        hoursDiff > 0 ? (oldestMoisture - latestMoisture) / hoursDiff : 0;

    // 4. Determine watering threshold based on species
    const speciesWatering = plant.species_cache?.watering;
    let threshold = 30;
    if (speciesWatering === "Frequent") threshold = 40;
    else if (speciesWatering === "Minimum") threshold = 20;
    else if (speciesWatering === "Average") threshold = 30;

    // 5. Calculate hours until threshold
    let hoursUntilThreshold: number;
    if (latestMoisture <= threshold) {
        hoursUntilThreshold = 0;
    } else if (depletionRate <= 0) {
        hoursUntilThreshold = 7 * 24;
    } else {
        hoursUntilThreshold = (latestMoisture - threshold) / depletionRate;
    }

    // 6. Temperature correction
    const avgTemp =
        measurements.reduce(
            (sum, m) => sum + (Number(m.air_temp_c) || 22),
            0
        ) / measurements.length;
    if (avgTemp > 28) hoursUntilThreshold *= 0.7;
    else if (avgTemp > 25) hoursUntilThreshold *= 0.85;
    else if (avgTemp < 15) hoursUntilThreshold *= 1.3;

    // 7. Compute next watering date
    const nextDate = new Date(
        Date.now() + hoursUntilThreshold * 60 * 60 * 1000
    );

    // 8. Recommended water amount based on pot volume
    const potVolume = plant.pot_volume_ml;
    let waterMl: number;
    if (potVolume) {
        waterMl = Math.round(potVolume * 0.2);
    } else if (plant.pot_diameter_cm && plant.pot_height_cm) {
        const r = Number(plant.pot_diameter_cm) / 2;
        const h = Number(plant.pot_height_cm);
        const volume = Math.PI * r * r * h;
        waterMl = Math.round(volume * 0.2);
    } else {
        waterMl = 150;
    }

    // 9. Confidence based on data quality
    let confidence = 0.5;
    if (measurements.length >= 20) confidence += 0.15;
    if (measurements.length >= 40) confidence += 0.1;
    if (depletionRate > 0) confidence += 0.15;
    if (hoursDiff > 24) confidence += 0.1;
    confidence = Math.min(confidence, 0.95);

    // 10. Get last watering event for context
    const { data: lastWateringRaw } = await supabase
        .from("watering_events")
        .select("*")
        .eq("plant_id", plantId)
        .order("happened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const lastWatering = lastWateringRaw as WateringEventRow | null;

    const result: PredictionResult = {
        nextWateringAt: nextDate.toISOString(),
        recommendedWaterMl: waterMl,
        confidence: Math.round(confidence * 100) / 100,
        details: {
            currentMoisturePct: latestMoisture,
            depletionRatePerHour: Math.round(depletionRate * 100) / 100,
            hoursUntilThreshold: Math.round(hoursUntilThreshold * 10) / 10,
            thresholdPct: threshold,
            avgTempC: Math.round(avgTemp * 10) / 10,
            measurementCount: measurements.length,
            speciesWatering: speciesWatering || "unknown",
            lastWateringAt: lastWatering?.happened_at || null,
            lastWateringMl: lastWatering?.water_ml || null,
        },
    };

    // 11. Save prediction to DB
    const insertData: PredictionInsert = {
        plant_id: plantId,
        next_watering_at: result.nextWateringAt,
        recommended_water_ml: result.recommendedWaterMl,
        confidence: result.confidence,
        model: "rulebased_v1",
        details: result.details as unknown as Json,
    };
    await supabase.from("predictions").insert(insertData);

    return result;
}

/**
 * Double-check before sending watering command.
 * Returns true if watering should proceed, false if should cancel/reschedule.
 */
export async function doubleCheckBeforeWatering(
    plantId: string
): Promise<{ shouldWater: boolean; reason: string }> {
    const supabase = createSupabaseAdmin();

    // 1. Check latest measurement
    const { data: latestRaw } = await supabase
        .from("measurements")
        .select("*")
        .eq("plant_id", plantId)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const latest = latestRaw as MeasurementRow | null;

    // 2. Check last watering event in last 12 hours
    const twelveHoursAgo = new Date(
        Date.now() - 12 * 60 * 60 * 1000
    ).toISOString();

    const { data: recentWateringRaw } = await supabase
        .from("watering_events")
        .select("*")
        .eq("plant_id", plantId)
        .gte("happened_at", twelveHoursAgo)
        .order("happened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const recentWatering = recentWateringRaw as WateringEventRow | null;

    // 3. Decision logic
    if (recentWatering) {
        return {
            shouldWater: false,
            reason: `Recent watering detected at ${recentWatering.happened_at} (${recentWatering.water_ml}ml). Skipping.`,
        };
    }

    if (latest && Number(latest.soil_moisture_pct) > 60) {
        return {
            shouldWater: false,
            reason: `Soil moisture already at ${latest.soil_moisture_pct}% (above 60% threshold). Skipping.`,
        };
    }

    return {
        shouldWater: true,
        reason: "All checks passed. Proceeding with watering.",
    };
}



