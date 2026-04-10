import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { doubleCheckBeforeWatering } from "@/lib/predictions/rule-based";
import type { Database } from "@/lib/supabase/database.types";

type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
type PlantRow = Database["public"]["Tables"]["plants"]["Row"];
type PlantUpdate = Database["public"]["Tables"]["plants"]["Update"];
type CommandRow = Database["public"]["Tables"]["device_commands"]["Row"];
type CommandInsert = Database["public"]["Tables"]["device_commands"]["Insert"];

const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_MINUTES = 60;

export type WaterResult = {
    success: boolean;
    commandId?: string;
    warning?: string;
    status?: string;
    deduplicated?: boolean;
    error?: string;
    check?: string;
};

export class IoTService {
    static async getClaimedDevices(userId: string) {
        const supabase = await createSupabaseServer();
        const { data: devices, error } = await supabase
            .from("devices")
            .select("id, display_name, channels_count, supports_pumps, supports_light, firmware_version, status, last_seen_at")
            .eq("owner_user_id", userId)
            .eq("status", "claimed")
            .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return devices || [];
    }

    static async claimDevice(userId: string, deviceId: string, claimCode: string) {
        const supabase = createSupabaseAdmin();

        // 1. Find device
        const { data: deviceRaw, error: deviceErr } = await supabase
            .from("devices")
            .select("*")
            .eq("id", deviceId)
            .single();

        const device = deviceRaw as DeviceRow | null;

        if (deviceErr || !device) {
            throw new Error("Device not found");
        }

        // 2. Check status
        if (device.status !== "unclaimed") {
            throw new Error("Device already claimed or revoked");
        }

        // 3. Rate-limit check
        if (device.failed_claim_attempts >= MAX_FAILED_ATTEMPTS) {
            const lastFailed = device.last_failed_claim_at
                ? new Date(device.last_failed_claim_at).getTime()
                : 0;
            const cooldownEnd = lastFailed + COOLDOWN_MINUTES * 60 * 1000;
            if (Date.now() < cooldownEnd) {
                const minutesLeft = Math.ceil((cooldownEnd - Date.now()) / 60000);
                throw new Error(`Too many failed attempts. Try again in ${minutesLeft} minutes.`);
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
            await supabase
                .from("devices")
                .update({
                    failed_claim_attempts: (device.failed_claim_attempts || 0) + 1,
                    last_failed_claim_at: new Date().toISOString(),
                } as DeviceUpdate)
                .eq("id", deviceId);

            throw new Error("Invalid claim code");
        }

        // 5. Claim device
        const { error: updateErr } = await supabase
            .from("devices")
            .update({
                owner_user_id: userId,
                status: "claimed",
                claim_code_used_at: new Date().toISOString(),
                failed_claim_attempts: 0,
            } as DeviceUpdate)
            .eq("id", deviceId);

        if (updateErr) throw new Error(`Failed to claim device: ${updateErr.message}`);

        return true;
    }

    static async unclaimDevice(userId: string, deviceId: string) {
        const supabase = createSupabaseAdmin();

        // 1. Verify ownership
        const { data: deviceRaw, error: deviceErr } = await supabase
            .from("devices")
            .select("id, owner_user_id")
            .eq("id", deviceId)
            .single();

        const device = deviceRaw as { id: string; owner_user_id: string | null } | null;

        if (deviceErr || !device) {
            throw new Error("Device not found");
        }

        if (device.owner_user_id !== userId) {
            throw new Error("Device not owned by you");
        }

        // 2. Unlink plants
        const { error: plantsErr } = await supabase
            .from("plants")
            .update({
                device_id: null,
                soil_channel: null,
                updated_at: new Date().toISOString()
            } as PlantUpdate)
            .eq("device_id", deviceId);

        if (plantsErr) {
            throw new Error(`Failed to unlink plants: ${plantsErr.message}`);
        }

        // 3. Reset device status
        const { error: updateErr } = await supabase
            .from("devices")
            .update({
                owner_user_id: null,
                status: "unclaimed",
                claim_code_used_at: null,
                display_name: null,
                last_seq: 0, // Optional: reset seq for fresh start?
                updated_at: new Date().toISOString()
            } as DeviceUpdate)
            .eq("id", deviceId);

        if (updateErr) {
            throw new Error(`Failed to unclaim device: ${updateErr.message}`);
        }

        return true;
    }

    static async swapChannels(userId: string, deviceId: string, plantId1: string, plantId2: string) {
        const supabase = createSupabaseAdmin();

        // 1. Verify device ownership
        const { data: deviceRaw } = await supabase
            .from("devices")
            .select("id, owner_user_id")
            .eq("id", deviceId)
            .single();
        
        const device = deviceRaw as { id: string; owner_user_id: string | null } | null;

        if (!device || device.owner_user_id !== userId) {
            throw new Error("Device not found or not owned by you");
        }

        // 2. Get both plants
        const { data: plants, error: plantsErr } = await supabase
            .from("plants")
            .select("id, device_id, soil_channel")
            .in("id", [plantId1, plantId2]);

        if (plantsErr || !plants || plants.length !== 2) {
            throw new Error("One or both plants not found");
        }

        const p1 = plants.find(p => p.id === plantId1)!;
        const p2 = plants.find(p => p.id === plantId2)!;

        if (p1.device_id !== deviceId || p2.device_id !== deviceId) {
            throw new Error("Both plants must belong to the same device");
        }

        const ch1 = p1.soil_channel;
        const ch2 = p2.soil_channel;

        if (ch1 === null || ch2 === null) {
            throw new Error("Both plants must be currently linked to channels");
        }

        // 3. Swap using temporary channel (to avoid unique constraints if any)
        // Note: soil_channel + device_id uniqueness might be enforced in DB.
        // We'll use a transaction-like approach or a temp value.
        // Supabase JS doesn't support multi-table transactions easily without RPC, 
        // but we can update sequentially.

        // Use a very high channel as temp if needed, or just null it out first.
        const { error: err1 } = await supabase.from("plants").update({ soil_channel: null } as PlantUpdate).eq("id", plantId1);
        if (err1) throw new Error("Swap failed at step 1");

        const { error: err2 } = await supabase.from("plants").update({ soil_channel: ch1 } as PlantUpdate).eq("id", plantId2);
        if (err2) {
            // rollback
            await supabase.from("plants").update({ soil_channel: ch1 } as PlantUpdate).eq("id", plantId1);
            throw new Error("Swap failed at step 2: " + err2.message);
        }

        const { error: err3 } = await supabase.from("plants").update({ soil_channel: ch2 } as PlantUpdate).eq("id", plantId1);
        if (err3) {
            throw new Error("Swap failed at step 3: " + err3.message);
        }

        return true;
    }

    static async waterPlant(userId: string, plantId: string, waterMl: number): Promise<WaterResult> {
        const supabase = createSupabaseAdmin();

        // Verify ownership and get device + channel
        const { data: plantRaw } = await supabase
            .from("plants")
            .select("*")
            .eq("id", plantId)
            .eq("owner_user_id", userId)
            .single();

        const plant = plantRaw as PlantRow | null;

        if (!plant) {
            throw new Error("Plant not found or unauthorized");
        }

        if (!plant.device_id || !plant.soil_channel) {
            throw new Error("Plant not linked to a device channel");
        }

        // Double-check before watering
        const check = await doubleCheckBeforeWatering(plantId);
        if (!check.shouldWater) {
            return {
                success: true,
                warning: check.reason,
                commandId: undefined
            };
        }

        // Idempotency key: manual:<plantId>:<timestamp_rounded_to_5min>
        const roundedTs = Math.floor(Date.now() / (5 * 60 * 1000));
        const idempotencyKey = `manual:${plantId}:${roundedTs}`;

        // Check for existing command with same idempotency key
        const { data: existingCmdRaw } = await supabase
            .from("device_commands")
            .select("*")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();

        const existingCmd = existingCmdRaw as CommandRow | null;

        if (existingCmd) {
            return {
                success: true,
                commandId: existingCmd.id,
                status: existingCmd.status,
                deduplicated: true
            };
        }

        // Create command
        const insertData: CommandInsert = {
            device_id: plant.device_id,
            type: "PUMP_WATER",
            payload: {
                channel: plant.soil_channel,
                water_ml: waterMl,
                max_duration_sec: Math.ceil(waterMl / 5),
            },
            status: "queued",
            send_after: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            idempotency_key: idempotencyKey,
        };

        const { data: commandRaw, error } = await supabase
            .from("device_commands")
            .insert(insertData)
            .select()
            .single();

        const command = commandRaw as CommandRow | null;

        if (error) {
            throw new Error(`Failed to create command: ${error.message}`);
        }

        return {
            success: true,
            commandId: command?.id,
            check: check.reason
        };
    }
}

