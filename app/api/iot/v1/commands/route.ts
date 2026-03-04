// app/api/iot/v1/commands/route.ts
// GET /api/iot/v1/commands?limit=10 — ESP32 отримує pending команди

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyIotDevice, isAuthError } from "@/lib/iot/auth";
import type { Database } from "@/lib/supabase/database.types";

type CommandRow = Database["public"]["Tables"]["device_commands"]["Row"];
type CommandUpdate = Database["public"]["Tables"]["device_commands"]["Update"];

export async function GET(req: NextRequest) {
    try {
        // Body is empty for GET, pass empty string for HMAC
        const authResult = await verifyIotDevice(req, "");
        if (isAuthError(authResult)) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const { deviceId } = authResult;
        const supabase = createSupabaseAdmin();

        const limitStr = req.nextUrl.searchParams.get("limit");
        const limit = Math.min(Math.max(parseInt(limitStr || "10", 10) || 10, 1), 50);

        const now = new Date().toISOString();

        // 1. Expire stale commands first
        await supabase
            .from("device_commands")
            .update({ status: "expired" } as CommandUpdate)
            .eq("device_id", deviceId)
            .in("status", ["queued", "sent"])
            .lt("expires_at", now);

        // 2. Fetch queued commands ready to send
        const { data: commandsRaw, error } = await supabase
            .from("device_commands")
            .select("*")
            .eq("device_id", deviceId)
            .eq("status", "queued")
            .lte("send_after", now)
            .gt("expires_at", now)
            .order("created_at", { ascending: true })
            .limit(limit);

        const commands = (commandsRaw ?? []) as CommandRow[];

        if (error) {
            console.error("[IoT commands] Query error:", error);
            return NextResponse.json(
                { error: "Failed to fetch commands" },
                { status: 500 }
            );
        }

        // 3. Mark fetched commands as 'sent'
        if (commands.length > 0) {
            const ids = commands.map((c) => c.id);
            await supabase
                .from("device_commands")
                .update({ status: "sent", sent_at: now } as CommandUpdate)
                .in("id", ids);
        }

        return NextResponse.json({
            commands: commands.map((c) => ({
                id: c.id,
                type: c.type,
                payload: c.payload,
            })),
        });
    } catch (err) {
        console.error("[GET /api/iot/v1/commands]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
