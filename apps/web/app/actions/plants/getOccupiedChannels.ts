// app/actions/plants/getOccupiedChannels.ts
'use server';

import { PlantsService } from "@/lib/services/plants.service";

export async function getOccupiedChannels(deviceId: string) {
    try {
        return await PlantsService.getOccupiedChannels(deviceId);
    } catch (e: unknown) {
        console.error("Failed to fetch occupied channels:", e);
        return [];
    }
}
