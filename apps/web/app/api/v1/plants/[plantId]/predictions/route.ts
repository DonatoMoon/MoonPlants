// app/api/v1/plants/[plantId]/predictions/route.ts
// GET /api/v1/plants/:plantId/predictions — отримати прогноз поливу

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";
import { predictNextWatering } from "@/lib/predictions/rule-based";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ plantId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { plantId } = await params;
        const supabase = createSupabaseAdmin();

        // Verify ownership
        const { data: plant } = await supabase
            .from("plants")
            .select("id")
            .eq("id", plantId)
            .eq("owner_user_id", user.id)
            .single();

        if (!plant) {
            return NextResponse.json(
                { error: "Plant not found" },
                { status: 404 }
            );
        }

        const prediction = await predictNextWatering(plantId);
        return NextResponse.json({ prediction });
    } catch (err) {
        console.error("[GET /api/v1/plants/:id/predictions]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

