// app/api/v1/cron/predict/route.ts
// GET /api/v1/cron/predict — запуск черги прогнозів та автополиву

import { NextRequest, NextResponse } from "next/server";
import { PredictionService } from "@/lib/services/prediction.service";
import { env } from "@/lib/env";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const cronSecret = env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
        }

        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

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
