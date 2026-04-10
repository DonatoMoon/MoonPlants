// app/actions/iot/claimDevice.ts
'use server';

import { revalidatePath } from "next/cache";
import { IoTService } from "@/lib/services/iot.service";

export async function claimDevice(userId: string, deviceId: string, claimCode: string) {
    try {
        await IoTService.claimDevice(userId, deviceId, claimCode);
        revalidatePath('/profile');
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to claim device";
        return { success: false, error: msg };
    }
}

export async function unclaimDevice(userId: string, deviceId: string) {
    try {
        await IoTService.unclaimDevice(userId, deviceId);
        revalidatePath('/profile');
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to unclaim device";
        return { success: false, error: msg };
    }
}

export async function swapChannels(userId: string, deviceId: string, plantId1: string, plantId2: string) {
    try {
        await IoTService.swapChannels(userId, deviceId, plantId1, plantId2);
        revalidatePath('/profile');
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to swap channels";
        return { success: false, error: msg };
    }
}

export async function getClaimedDevices(userId: string) {
    try {
        return await IoTService.getClaimedDevices(userId);
    } catch (e: unknown) {
        console.error("Failed to fetch devices:", e);
        return [];
    }
}
