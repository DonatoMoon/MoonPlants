// app/actions/plants/addPlant.ts
'use server';

import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getOrCacheSpecies } from "@/lib/species/cache";

type AddPlantArgs = {
    user_id: string;
    nickname: string;
    species_name: string;
    perenual_id: number;
    image_file?: File | null;
    age_months?: number | null;
    pot_height_cm?: number | null;
    pot_diameter_cm?: number | null;
    last_watered_at: Date | null;
};


export async function addPlant(data: AddPlantArgs) {
    const supabase = await createSupabaseServer();
    let image_url: string | null = null;
    let image_source: 'user' | 'perenual' | 'none' = 'none';
    let species_cache_id: string | null = null;

    // 1. Cache species from Perenual + download image
    if (data.perenual_id) {
        try {
            const speciesRaw = await getOrCacheSpecies(data.perenual_id);
            const species = speciesRaw as { id: string; default_image_url: string | null } | null;
            if (species) {
                species_cache_id = species.id;
                if (!data.image_file && species.default_image_url) {
                    image_url = species.default_image_url;
                    image_source = 'perenual';
                }
            }
        } catch (err) {
            console.warn("[addPlant] Species cache failed:", err);
        }
    }

    // 2. User upload takes priority
    if (data.image_file) {
        const file = data.image_file;
        const ext = file.name.split('.').pop();
        const filename = `plant_${Date.now()}.${ext}`;
        const { error: storageErr } = await supabase.storage
            .from('plants')
            .upload(filename, file, { upsert: false });
        if (storageErr) throw new Error(storageErr.message);
        image_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plants/${filename}`;
        image_source = 'user';
    }

    // 3. Insert plant
    const { error } = await supabase
        .from('plants')
        .insert([{
            owner_user_id: data.user_id,
            name: data.nickname,
            species_name: data.species_name,
            species_cache_id,
            image_url,
            image_source,
            age_months: data.age_months ? Number(data.age_months) : null,
            pot_height_cm: data.pot_height_cm ? Number(data.pot_height_cm) : null,
            pot_diameter_cm: data.pot_diameter_cm ? Number(data.pot_diameter_cm) : null,
            last_watered_at: data.last_watered_at,
        }]);
    if (error) throw new Error(error.message);

    revalidatePath('/profile');
    return true;
}
