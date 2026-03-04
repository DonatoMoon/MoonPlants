// app/api/v1/plants/[plantId]/route.ts
// GET /api/v1/plants/:plantId — деталі рослини
// DELETE /api/v1/plants/:plantId — видалити рослину

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";

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

        // Plant + species cache
        const { data: plant, error } = await supabase
            .from("plants")
            .select("*, species_cache:species_cache_id(*)")
            .eq("id", plantId)
            .eq("owner_user_id", user.id)
            .single();

        if (error || !plant) {
            return NextResponse.json(
                { error: "Plant not found" },
                { status: 404 }
            );
        }

        // Last measurement
        const { data: lastMeasurement } = await supabase
            .from("measurements")
            .select("*")
            .eq("plant_id", plantId)
            .order("measured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        // Last prediction
        const { data: lastPrediction } = await supabase
            .from("predictions")
            .select("*")
            .eq("plant_id", plantId)
            .order("predicted_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        return NextResponse.json({
            plant,
            lastMeasurement,
            lastPrediction,
        });
    } catch (err) {
        console.error("[GET /api/v1/plants/:id]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
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
            .select("id, owner_user_id")
            .eq("id", plantId)
            .eq("owner_user_id", user.id)
            .single();

        if (!plant) {
            return NextResponse.json(
                { error: "Plant not found" },
                { status: 404 }
            );
        }

        // Delete (CASCADE removes measurements, predictions, watering_events)
        const { error } = await supabase
            .from("plants")
            .delete()
            .eq("id", plantId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[DELETE /api/v1/plants/:id]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

