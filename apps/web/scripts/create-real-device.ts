import { createSupabaseAdmin } from "../lib/supabase/admin";
import { createHash } from "crypto";

async function main() {
    const supabase = createSupabaseAdmin();
    
    const deviceId = "00000000-0000-0000-0000-000000000002";
    const claimCode = "REAL-ESP32-CODE-2026";
    const hmacSecret = "esp32_real_secret_key_123"; 
    
    const claimCodeHash = createHash("sha256").update(claimCode).digest("hex");
    
    const hmacSecretHex = "\\x" + Buffer.from(hmacSecret, 'utf8').toString('hex');

    console.log("--- Setting up real ESP32 device ---");

    await supabase.from("devices").delete().eq("id", deviceId);

    const { error: devErr } = await supabase.from("devices").insert({
        id: deviceId,
        status: "unclaimed",
        display_name: "Real ESP32 Controller",
        channels_count: 4,
        supports_pumps: true,
        supports_light: true,
        claim_code_hash: claimCodeHash
    });

    if (devErr) {
        console.error("Error creating device:", devErr.message);
        return;
    }

    const { error: credErr } = await supabase.from("device_credentials").insert({
        device_id: deviceId,
        hmac_secret: hmacSecretHex as any
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
