// lib/predictions/ml-api.ts
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface MLPredictionResponse {
    plant_id: string;
    timestamp: string;
    current_moisture: number;
    time_to_water_hours: number;
    recommended_ml: number;
    confidence: "high" | "medium" | "low";
    trajectory_hours: number | null;
    tte_pred_hours: number;
    low_threshold: number;
    high_target: number;
    rationale: string;
}

export async function fetchMLPrediction(plantId: string): Promise<MLPredictionResponse> {
    // Шукаємо змінні в різних варіантах написання
    let ML_API_URL = process.env.ML_API_URL || process.env.NEXT_PUBLIC_ML_API_URL;
    const ML_API_KEY = process.env.ML_API_KEY || process.env.ML_API_SECRET_KEY || process.env.API_SECRET_KEY;

    if (!ML_API_URL || !ML_API_KEY) {
        console.error("[ML API] Missing config in process.env:", { 
            hasUrl: !!ML_API_URL, 
            hasKey: !!ML_API_KEY,
        });
        throw new Error(`ML API configuration missing. Please check your .env.local and restart the server.`);
    }

    // Очищуємо URL: прибираємо пробіли, зайві слеші та додаємо https:// якщо треба
    ML_API_URL = ML_API_URL.trim().replace(/\/+$/, "");
    if (!ML_API_URL.startsWith("http")) {
        ML_API_URL = `https://${ML_API_URL}`;
    }

    if (ML_API_URL.includes("railway.com/project")) {
        throw new Error("Wrong ML_API_URL! Use the Public Domain from Railway Settings.");
    }

    const apiUrl = `${ML_API_URL}/api/v1/predict`;
    console.log(`[ML API] Fetching from: ${apiUrl}`);
    console.log(`[ML API] Key diagnostics: length=${ML_API_KEY.length}, startsWith=${ML_API_KEY.substring(0, 2)}...`);

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": ML_API_KEY,
        },
        body: JSON.stringify({
            plant_id: plantId,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML API error (${response.status}): ${errorText}`);
    }

    return response.json();
}

export async function saveMLPrediction(plantId: string, mlData: MLPredictionResponse) {
    const supabase = createSupabaseAdmin();

    const nextWateringAt = new Date();
    nextWateringAt.setSeconds(nextWateringAt.getSeconds() + (mlData.time_to_water_hours * 3600));

    const insertData = {
        plant_id: plantId,
        next_watering_at: nextWateringAt.toISOString(),
        recommended_water_ml: Math.round(mlData.recommended_ml),
        confidence: mlData.confidence === "high" ? 0.9 : mlData.confidence === "medium" ? 0.6 : 0.3,
        model: "ml_lstm_v1",
        details: {
            ...mlData,
            rationale: mlData.rationale,
            source: "railway_ml_api"
        } as any,
    };

    const { data, error } = await supabase
        .from("predictions")
        .insert(insertData)
        .select()
        .single();

    if (error) {
        console.error("Error saving ML prediction:", error);
        throw error;
    }

    return data;
}
