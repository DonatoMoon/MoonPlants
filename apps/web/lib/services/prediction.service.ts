// lib/services/prediction.service.ts

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchMLPrediction, saveMLPrediction } from "@/lib/predictions/ml-api";
import { IoTService } from "./iot.service";

export class PredictionService {
    static async runBatchPredictions() {
        const supabase = createSupabaseAdmin();
        const results = {
            processed: 0,
            watered: 0,
            errors: [] as {plantId: string; error: string}[]
        };

        // 0. Check if cron is globally enabled
        const { data: settings } = await supabase
            .from("app_settings")
            .select("is_cron_enabled")
            .eq("id", 1)
            .single();

        if (settings && settings.is_cron_enabled === false) {
            console.log("[PredictionService] Cron jobs are globally disabled via app_settings.");
            return {
                ...results,
                message: "Cron is manually disabled in system settings."
            };
        }

        // 1. Fetch all plants linked to a device
        const { data: plants, error } = await supabase
            .from("plants")
            .select("id, owner_user_id, auto_watering_enabled, device_id, soil_channel")
            .not("device_id", "is", null);

        if (error) throw new Error(`Failed to fetch plants: ${error.message}`);

        for (const plant of (plants || [])) {
            try {
                // 2. Run ML prediction logic (fetch and save)
                const mlData = await fetchMLPrediction(plant.id);
                const prediction = await saveMLPrediction(plant.id, mlData);
                results.processed++;

                // 3. Auto-watering check
                if (
                    plant.auto_watering_enabled && 
                    prediction.next_watering_at &&
                    new Date(prediction.next_watering_at) <= new Date() &&
                    prediction.recommended_water_ml
                ) {
                    console.log(`[PredictionService] Auto-watering triggered for plant ${plant.id}`);
                    
                    const waterRes = await IoTService.waterPlant(
                        plant.owner_user_id,
                        plant.id,
                        prediction.recommended_water_ml
                    );

                    if (waterRes.success && !waterRes.warning) {
                        results.watered++;
                    }
                }
            } catch (err: unknown) {
                console.error(`[PredictionService] Error processing plant ${plant.id}:`, err);
                results.errors.push({ plantId: plant.id, error: err instanceof Error ? err.message : String(err) });
            }
        }

        return results;
    }
}
