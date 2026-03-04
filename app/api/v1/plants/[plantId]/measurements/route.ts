// app/api/v1/plants/[plantId]/measurements/route.ts
// GET /api/v1/plants/:plantId/measurements?from=...&to=...&limit=...

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";

export async function GET(
    req: NextRequest,
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

        // Parse query params
        const searchParams = req.nextUrl.searchParams;
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const limitStr = searchParams.get("limit");
        const limit = Math.min(Math.max(parseInt(limitStr || "200", 10) || 200, 1), 1000);

        let query = supabase
            .from("measurements")
            .select(
                "id, soil_moisture_pct, soil_moisture_raw, air_temp_c, air_humidity_pct, light_lux, battery_v, measured_at"
            )
            .eq("plant_id", plantId)
            .order("measured_at", { ascending: false })
            .limit(limit);

        if (from) {
            query = query.gte("measured_at", from);
        }
        if (to) {
            query = query.lte("measured_at", to);
        }

        const { data: measurements, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ measurements: measurements ?? [] });
    } catch (err) {
        console.error("[GET /api/v1/plants/:id/measurements]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

