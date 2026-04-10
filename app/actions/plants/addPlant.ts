// app/actions/plants/addPlant.ts
'use server';

import { revalidatePath } from "next/cache";
import { PlantsService } from "@/lib/services/plants.service";

type AddPlantArgs = {
    user_id: string;
    nickname: string;
    species_name: string;
    perenual_id?: number | null;
    image_file?: File | null;
    device_id?: string | null;
    soil_channel?: number | null;
    age_months?: number | null;
    pot_height_cm?: number | null;
    pot_diameter_cm?: number | null;
    last_watered_at: Date | null;
};


export async function addPlant(data: AddPlantArgs) {
    try {
        await PlantsService.addPlant({
            userId: data.user_id,
            name: data.nickname, // Mapping nickname from UI to name in service
            speciesName: data.species_name,
            perenualId: data.perenual_id,
            imageFile: data.image_file,
            deviceId: data.device_id,
            soilChannel: data.soil_channel,
            ageMonths: data.age_months,
            potHeightCm: data.pot_height_cm,
            potDiameterCm: data.pot_diameter_cm,
            lastWateredAt: data.last_watered_at,
        });

        revalidatePath('/profile');
        return true;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to add plant";
        throw new Error(msg);
    }
}
