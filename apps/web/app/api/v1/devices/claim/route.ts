// app/api/v1/devices/claim/route.ts
// POST /api/v1/devices/claim — прив'язка девайса до аккаунту

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/getUser";
import { claimDeviceSchema } from "@/lib/iot/schemas";
import type { Database } from "@/lib/supabase/database.types";

type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];

const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 60;

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const parsed = claimDeviceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { deviceId, claimCode } = parsed.data;
        const supabase = createSupabaseAdmin();

        // 1. Find device
        const { data: deviceRaw, error: deviceErr } = await supabase
            .from("devices")
            .select("*")
            .eq("id", deviceId)
            .single();

        const device = deviceRaw as DeviceRow | null;

        if (deviceErr || !device) {
            return NextResponse.json(
                { error: "Device not found" },
                { status: 404 }
            );
        }

        // 2. Check status
        if (device.status !== "unclaimed") {
            return NextResponse.json(
                { error: "Device already claimed or revoked" },
                { status: 409 }
            );
        }

        // 3. Rate-limit check
        if (device.failed_claim_attempts >= MAX_FAILED_ATTEMPTS) {
            const lastFailed = device.last_failed_claim_at
                ? new Date(device.last_failed_claim_at).getTime()
                : 0;
            const cooldownEnd = lastFailed + COOLDOWN_MINUTES * 60 * 1000;
            if (Date.now() < cooldownEnd) {
                const minutesLeft = Math.ceil(
                    (cooldownEnd - Date.now()) / 60000
                );
                return NextResponse.json(
                    {
                        error: `Too many failed attempts. Try again in ${minutesLeft} minutes.`,
                    },
                    { status: 429 }
                );
            }
            // Cooldown passed — reset counter
            await supabase
                .from("devices")
                .update({ failed_claim_attempts: 0 } as DeviceUpdate)
                .eq("id", deviceId);
        }

        // 4. Verify claim code
        const codeHash = createHash("sha256")
            .update(claimCode)
            .digest("hex");

        if (codeHash !== device.claim_code_hash) {
            // Increment failed attempts
            await supabase
                .from("devices")
                .update({
                    failed_claim_attempts: (device.failed_claim_attempts || 0) + 1,
                    last_failed_claim_at: new Date().toISOString(),
                } as DeviceUpdate)
                .eq("id", deviceId);

            return NextResponse.json(
                { error: "Invalid claim code" },
                { status: 403 }
            );
        }

        // 5. Claim device
        const { error: updateErr } = await supabase
            .from("devices")
            .update({
                owner_user_id: user.id,
                status: "claimed",
                claim_code_used_at: new Date().toISOString(),
                failed_claim_attempts: 0,
            } as DeviceUpdate)
            .eq("id", deviceId);

        if (updateErr) {
            return NextResponse.json(
                { error: "Failed to claim device" },
                { status: 500 }
            );
        }

        // 6. Return device info
        const { data: claimed } = await supabase
            .from("devices")
            .select(
                "id, display_name, channels_count, supports_pumps, supports_light, firmware_version, status"
            )
            .eq("id", deviceId)
            .single();

        return NextResponse.json({ device: claimed });
    } catch (err) {
        console.error("[POST /api/v1/devices/claim]", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
