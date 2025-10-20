// app/actions/plants/addPlant.ts
'use server';

import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type AddPlantArgs = {
    user_id: string;
    nickname: string;
    species_name: string;
    species_id: number;
    image_file?: File | null;
    age_months?: number | null;
    pot_height_cm?: number | null;
    pot_diameter_cm?: number | null;
    last_watered_at: Date | null;
};


export async function addPlant(data: AddPlantArgs) {
    const supabase = await createSupabaseServer();
    let image_url: string | null = null;

    if (data.image_file) {
        const file = data.image_file;
        const ext = file.name.split('.').pop();
        const filename = `plant_${Date.now()}.${ext}`;
        const { error: storageErr } = await supabase.storage
            .from('plants')
            .upload(filename, file, { upsert: false });
        if (storageErr) throw new Error(storageErr.message);
        image_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plants/${filename}`;
    }

    const { error } = await supabase
        .from('plants')
        .insert([{
            user_id: data.user_id,
            name: data.nickname,
            species_name: data.species_name,
            species_id: data.species_id, // <--- ДОДАНО
            image_url: image_url,
            age_months: data.age_months ? Number(data.age_months) : null,
            pot_height_cm: data.pot_height_cm ? Number(data.pot_height_cm) : null,
            pot_diameter_cm: data.pot_diameter_cm ? Number(data.pot_diameter_cm) : null,
            last_watered_at: data.last_watered_at,
            created_at: new Date().toISOString(),
        }]);
    if (error) throw new Error(error.message);

    revalidatePath('/profile');
    return true;
}
