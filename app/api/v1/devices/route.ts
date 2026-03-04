// app/api/v1/devices/route.ts
// GET /api/v1/devices — список девайсів користувача

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
        const { data: devices, error } = await supabase
            .from("devices")
            .select(
                "id, display_name, channels_count, supports_pumps, supports_light, firmware_version, status, last_seen_at, created_at"
            )
            .eq("owner_user_id", user.id)
            .eq("status", "claimed")
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ devices: devices ?? [] });
    } catch (err) {
        console.error("[GET /api/v1/devices]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

