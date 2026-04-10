// scripts/create-test-device.ts
import { createSupabaseAdmin } from "../lib/supabase/admin";
import { createHash } from "crypto";

async function main() {
    const supabase = createSupabaseAdmin();
    
    const deviceId = "00000000-0000-0000-0000-000000000001";
    const claimCode = "TEST-CLAIM-CODE-2026";
    const hmacSecret = "test_secret_key_123"; 
    
    const claimCodeHash = createHash("sha256").update(claimCode).digest("hex");
    
    // To properly write to a Postgres bytea column via Supabase JS, 
    // the hex string MUST be prefixed with \x, otherwise it double-encodes the string characters.
    const hmacSecretHex = "\\x" + Buffer.from(hmacSecret, 'utf8').toString('hex');

    console.log("--- Setting up test device ---");

    // 1. Delete if exists (for clean test)
    await supabase.from("devices").delete().eq("id", deviceId);

    // 2. Insert device
    const { error: devErr } = await supabase.from("devices").insert({
        id: deviceId,
        status: "unclaimed",
        display_name: "Test Controller V1",
        channels_count: 4,
        supports_pumps: true,
        supports_light: true,
        claim_code_hash: claimCodeHash
    });

    if (devErr) {
        console.error("Error creating device:", devErr.message);
        return;
    }

    // 3. Insert credentials
    const { error: credErr } = await supabase.from("device_credentials").insert({
        device_id: deviceId,
        hmac_secret: hmacSecretHex as any // Now it's \x7465...
    });

    if (credErr) {
        console.error("Error creating credentials:", credErr.message);
        return;
    }

    console.log("SUCCESS!");
    console.log(`Device ID:  ${deviceId}`);
    console.log(`Claim Code: ${claimCode}`);
    console.log(`HMAC Secret: ${hmacSecret}`);
    console.log("------------------------------");
}

main();
