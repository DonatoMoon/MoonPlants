// app/api/v1/plants/disconnected/route.ts
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: plants, error } = await supabase
            .from("plants")
            .select("id, name, species_name")
            .eq("owner_user_id", user.id)
            .is("device_id", null)
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ plants: plants ?? [] });
    } catch (err) {
        console.error("[GET /api/v1/plants/disconnected]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
