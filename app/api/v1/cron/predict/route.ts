// app/api/v1/cron/predict/route.ts
// GET /api/v1/cron/predict — запуск черги прогнозів та автополиву

import { NextRequest, NextResponse } from "next/server";
import { PredictionService } from "@/lib/services/prediction.service";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Simple CRON_SECRET check to prevent manual calls (should be set in env)
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'test_cron_secret';
        
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[CRON] Running batch predictions...");
        const results = await PredictionService.runBatchPredictions();
        
        return NextResponse.json({
            status: "success",
            results
        });
    } catch (err: unknown) {
        console.error("[CRON ERROR]", err);
        return NextResponse.json({ 
            status: "error", 
            message: err instanceof Error ? err.message : String(err) 
        }, { status: 500 });
    }
}
