// app/api/v1/plants/[plantId]/watering-events/route.ts
// POST /api/v1/plants/:plantId/watering-events — записати ручний полив

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";
import { createWateringEventSchema } from "@/lib/iot/schemas";
import type { Database } from "@/lib/supabase/database.types";

type WateringEventInsert = Database["public"]["Tables"]["watering_events"]["Insert"];
type PlantUpdate = Database["public"]["Tables"]["plants"]["Update"];

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ plantId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { plantId } = await params;
        const body = await req.json();
        const parsed = createWateringEventSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

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

        const happenedAt =
            parsed.data.happenedAt || new Date().toISOString();

        // Insert watering event
        const insertData: WateringEventInsert = {
            plant_id: plantId,
            source: "manual",
            water_ml: parsed.data.waterMl || null,
            happened_at: happenedAt,
            note: parsed.data.note || null,
        };

        const { data: event, error } = await supabase
            .from("watering_events")
            .insert(insertData)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Update plant last_watered_at
        await supabase
            .from("plants")
            .update({ last_watered_at: happenedAt } as PlantUpdate)
            .eq("id", plantId);

        return NextResponse.json({ event }, { status: 201 });
    } catch (err) {
        console.error("[POST /api/v1/plants/:id/watering-events]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
