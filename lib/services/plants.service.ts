import { createSupabaseServer } from "@/lib/supabase/server";
import { getOrCacheSpecies } from "@/lib/species/cache";

type AddPlantDTO = {
    userId: string;
    name: string;
    speciesName: string;
    perenualId?: number | null;
    imageFile?: File | null;
    deviceId?: string | null;
    soilChannel?: number | null;
    potVolumeMl?: number | null;
    potHeightCm?: number | null;
    potDiameterCm?: number | null;
    ageMonths?: number | null;
    lastWateredAt?: Date | null;
};

export class PlantsService {
    static async addPlant(data: AddPlantDTO) {
        const supabase = await createSupabaseServer();
        let image_url: string | null = null;
        let image_source: 'user' | 'perenual' | 'none' = 'none';
        let species_cache_id: string | null = null;

        // 1. If device specified, verify ownership and channel availability
        if (data.deviceId) {
            const { data: device, error: deviceErr } = await supabase
                .from("devices")
                .select("id, owner_user_id, status, channels_count")
                .eq("id", data.deviceId)
                .single();

            if (deviceErr || !device) {
                throw new Error("Device not found or not owned by you");
            }

            if (device.owner_user_id !== data.userId) {
                throw new Error("Device not owned by you");
            }

            if (device.status !== "claimed") {
                throw new Error("Device not claimed");
            }

            if (
                data.soilChannel &&
                (data.soilChannel < 1 || data.soilChannel > (device.channels_count || 4))
            ) {
                throw new Error(`Channel must be between 1 and ${device.channels_count}`);
            }

            // Check channel not already taken
            if (data.soilChannel) {
                const { data: existing } = await supabase
                    .from("plants")
                    .select("id")
                    .eq("device_id", data.deviceId)
                    .eq("soil_channel", data.soilChannel)
                    .maybeSingle();

                if (existing) {
                    throw new Error(`Channel ${data.soilChannel} is already in use on this device`);
                }
            }
        }

        // 2. Cache species from Perenual + download image fallback
        if (data.perenualId) {
            try {
                const speciesRaw = await getOrCacheSpecies(data.perenualId);
                const species = speciesRaw as { id: string; default_image_url: string | null } | null;
                
                if (species) {
                    species_cache_id = species.id;
                    if (!data.imageFile && species.default_image_url) {
                        image_url = species.default_image_url;
                        image_source = 'perenual';
                    }
                }
            } catch (err) {
                console.warn("[PlantsService.addPlant] Species cache failed:", err);
            }
        }

        // 3. User upload takes priority
        if (data.imageFile) {
            const file = data.imageFile;
            const ext = file.name.split('.').pop();
            const filename = `plant_${Date.now()}.${ext}`;
            const { error: storageErr } = await supabase.storage
                .from('plants')
                .upload(filename, file, { upsert: false });
            
            if (storageErr) throw new Error(`Storage error: ${storageErr.message}`);
            
            image_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plants/${filename}`;
            image_source = 'user';
        }

        // 4. Insert plant
        const { data: newPlant, error } = await supabase
            .from('plants')
            .insert([{
                owner_user_id: data.userId,
                device_id: data.deviceId || null,
                soil_channel: data.soilChannel || null,
                name: data.name,
                species_name: data.speciesName,
                species_cache_id,
                image_url,
                image_source,
                age_months: data.ageMonths ? Number(data.ageMonths) : null,
                pot_volume_ml: data.potVolumeMl ? Number(data.potVolumeMl) : null,
                pot_height_cm: data.potHeightCm ? Number(data.potHeightCm) : null,
                pot_diameter_cm: data.potDiameterCm ? Number(data.potDiameterCm) : null,
                last_watered_at: data.lastWateredAt ? data.lastWateredAt.toISOString() : null,
            }])
            .select()
            .single();

        if (error) throw new Error(`Database error: ${error.message}`);
        
        return newPlant;
    }

    static async updatePlantPhoto(userId: string, plantId: string, imageFile: File) {
        const supabase = await createSupabaseServer();

        // 1. Ownership check
        const { data: plant, error: plantErr } = await supabase
            .from("plants")
            .select("id, owner_user_id")
            .eq("id", plantId)
            .single();

        if (plantErr || !plant || plant.owner_user_id !== userId) {
            throw new Error("Plant not found or not owned by you");
        }

        // 2. Upload to storage
        const ext = imageFile.name.split('.').pop() || 'png';
        const filename = `plant_${plantId}_${Date.now()}.${ext}`;
        
        const { error: uploadErr } = await supabase.storage
            .from('plants')
            .upload(filename, imageFile, { upsert: false });

        if (uploadErr) throw new Error(`Upload error: ${uploadErr.message}`);

        const image_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plants/${filename}`;

        // 3. Update DB
        const { error: updateErr } = await supabase
            .from("plants")
            .update({
                image_url,
                image_source: 'user',
                updated_at: new Date().toISOString()
            })
            .eq("id", plantId);

        if (updateErr) throw new Error(`Database update error: ${updateErr.message}`);

        return { image_url };
    }

    static async getOccupiedChannels(deviceId: string) {
        const supabase = await createSupabaseServer();
        const { data, error } = await supabase
            .from("plants")
            .select("soil_channel")
            .eq("device_id", deviceId)
            .not("soil_channel", "is", null);

        if (error) throw new Error(error.message);
        return (data || []).map(p => p.soil_channel as number);
    }
}

