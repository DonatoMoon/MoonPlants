// apps/web/app/actions/predictions/getMLPrediction.ts
'use server';

import { fetchMLPrediction, saveMLPrediction } from "@/lib/predictions/ml-api";
import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getMLPrediction(plantId: string) {
    try {
        const supabase = await createSupabaseServer();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        // 1. Verify user owns the plant
        const { data: plant, error: plantError } = await supabase
            .from("plants")
            .select("id")
            .eq("id", plantId)
            .eq("owner_user_id", user.id)
            .maybeSingle();

        if (plantError || !plant) {
            throw new Error("Plant not found or access denied");
        }

        // 2. Fetch from Railway ML API
        const mlData = await fetchMLPrediction(plantId);

        // 3. Save to Supabase predictions table
        const savedData = await saveMLPrediction(plantId, mlData);

        // 4. Revalidate the page
        revalidatePath(`/profile/${plantId}`);

        return { success: true, data: savedData };
    } catch (error: unknown) {
        console.error("[Action: getMLPrediction] Error:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
