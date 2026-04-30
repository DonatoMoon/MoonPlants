// lib/iot/auth.ts
// HMAC-SHA256 аутентифікація IoT пристроїв
//
// Device sends headers:
//   X-Device-Id:         <uuid>
//   X-Device-Seq:        <uint64>  monotonic counter stored in flash
//   X-Device-Timestamp:  <unix_seconds>
//   X-Content-SHA256:    <hex sha256(body)>
//   X-Device-Signature:  <base64url(hmac_sha256(secret, canonical_string))>
//
// canonical_string =
//   METHOD\nPATH\nX-Device-Id\nX-Device-Seq\nX-Device-Timestamp\nX-Content-SHA256

import { createHmac, createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type CredentialRow = Database["public"]["Tables"]["device_credentials"]["Row"];

export type DeviceAuthResult = {
    deviceId: string;
    seq: number;
};

export type DeviceAuthError = {
    error: string;
    status: number;
};

const TIMESTAMP_TOLERANCE_SEC = 120; // ±2 хвилини

export async function verifyIotDevice(
    request: Request,
    body: string
): Promise<DeviceAuthResult | DeviceAuthError> {
    const deviceId = request.headers.get("x-device-id");
    const seqStr = request.headers.get("x-device-seq");
    const timestampStr = request.headers.get("x-device-timestamp");
    const contentHash = request.headers.get("x-content-sha256");
    const signature = request.headers.get("x-device-signature");

    // 1. Check all required headers present
    if (!deviceId || !seqStr || !timestampStr || !contentHash || !signature) {
        return { error: "Missing required device auth headers", status: 401 };
    }

    const seq = parseInt(seqStr, 10);
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(seq) || isNaN(timestamp)) {
        return { error: "Invalid seq or timestamp", status: 400 };
    }

    // 2. Timestamp check
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SEC) {
        return { error: "Timestamp out of range", status: 401 };
    }

    // 3. Verify content hash
    const computedHash = createHash("sha256").update(body).digest("hex");
    if (computedHash !== contentHash) {
        return { error: "Content hash mismatch", status: 401 };
    }

    // 4. Load device + credentials from DB
    const supabase = createSupabaseAdmin();

    const { data: deviceRaw, error: deviceErr } = await supabase
        .from("devices")
        .select("*")
        .eq("id", deviceId)
        .single();

    const device = deviceRaw as DeviceRow | null;

    if (deviceErr || !device) {
        return { error: "Device not found", status: 401 };
    }

    if (device.status !== "claimed") {
        return { error: "Device not claimed", status: 403 };
    }

    const { data: credRaw, error: credErr } = await supabase
        .from("device_credentials")
        .select("*")
        .eq("device_id", deviceId)
        .single();

    const cred = credRaw as CredentialRow | null;

    if (credErr || !cred) {
        return { error: "Device credentials not found", status: 401 };
    }

    // 5. Anti-replay: seq must be > last_seq
    if (seq <= device.last_seq) {
        return { error: "Replay detected: seq too low", status: 401 };
    }

    // 6. Compute canonical string and verify signature
    const url = new URL(request.url);
    const canonical = [
        request.method,
        url.pathname,
        deviceId,
        seqStr,
        timestampStr,
        contentHash,
    ].join("\n");

    // hmac_secret is stored as bytea; Supabase returns it as hex-encoded string
    // potentially prefixed with \x
    let rawSecret = cred.hmac_secret as string;
    if (rawSecret.startsWith("\\x")) {
        rawSecret = rawSecret.slice(2);
    }
    const secretBuffer = Buffer.from(rawSecret, "hex");
    
    const expectedSig = createHmac("sha256", secretBuffer)
        .update(canonical)
        .digest("base64url");

    if (signature !== expectedSig) {
        return { error: "Invalid signature", status: 401 };
    }

    // 7. Update device state atomically (anti-replay check)
    const { data: updatedData, error: updateErr } = await supabase
        .from("devices")
        .update({
            last_seq: seq,
            last_seen_at: new Date().toISOString(),
        } as Database["public"]["Tables"]["devices"]["Update"])
        .eq("id", deviceId)
        .lt("last_seq", seq) // Atomic check: update only if new seq is higher
        .select();

    if (updateErr || !updatedData || updatedData.length === 0) {
        return { error: "Replay detected: seq already used or outdated", status: 401 };
    }

    return { deviceId, seq };
}

// Helper: check if result is an error
export function isAuthError(
    result: DeviceAuthResult | DeviceAuthError
): result is DeviceAuthError {
    return "error" in result;
}


