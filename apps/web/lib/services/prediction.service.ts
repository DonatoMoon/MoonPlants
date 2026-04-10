// lib/services/prediction.service.ts

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { predictNextWatering } from "@/lib/predictions/rule-based";
import { IoTService } from "./iot.service";

export class PredictionService {
    static async runBatchPredictions() {
        const supabase = createSupabaseAdmin();
        const results = {
            processed: 0,
            watered: 0,
            errors: [] as {plantId: string; error: string}[]
        };

        // 1. Fetch all plants linked to a device
        const { data: plants, error } = await supabase
            .from("plants")
            .select("id, owner_user_id, auto_watering_enabled, device_id, soil_channel")
            .not("device_id", "is", null);

        if (error) throw new Error(`Failed to fetch plants: ${error.message}`);

        for (const plant of (plants || [])) {
            try {
                // 2. Run prediction logic (this also saves prediction to DB)
                const prediction = await predictNextWatering(plant.id);
                results.processed++;

                // 3. Auto-watering check
                if (
                    plant.auto_watering_enabled && 
                    prediction.nextWateringAt && 
                    new Date(prediction.nextWateringAt) <= new Date() &&
                    prediction.recommendedWaterMl
                ) {
                    console.log(`[PredictionService] Auto-watering triggered for plant ${plant.id}`);
                    
                    const waterRes = await IoTService.waterPlant(
                        plant.owner_user_id,
                        plant.id,
                        prediction.recommendedWaterMl
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
