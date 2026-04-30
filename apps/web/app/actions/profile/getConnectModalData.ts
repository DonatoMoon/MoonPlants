'use server';

import { getCurrentUser } from '@/lib/auth/getUser';
import { createSupabaseServer } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';

export type DisconnectedPlant = {
    id: string;
    name: string;
    species_name: string | null;
};

export type ConnectModalData = {
    disconnectedPlants: DisconnectedPlant[];
    freeChannels: number[];
};

export async function getConnectModalData(deviceId: string): Promise<ConnectModalData> {
    const user = await getCurrentUser();
    if (!user) throw new AppError('unauthorized', 'Не авторизовано', 401);

    const supabase = await createSupabaseServer();

    const [plantsRes, deviceRes] = await Promise.all([
        supabase
            .from('plants')
            .select('id, name, species_name')
            .eq('owner_user_id', user.id)
            .is('device_id', null)
            .order('name'),
        supabase
            .from('devices')
            .select('channels_count, plants(soil_channel)')
            .eq('id', deviceId)
            .eq('owner_user_id', user.id)
            .single(),
    ]);

    if (deviceRes.error || !deviceRes.data) {
        throw new AppError('not_found', 'Пристрій не знайдено', 404);
    }

    const disconnectedPlants: DisconnectedPlant[] = (plantsRes.data ?? []).map(p => ({
        id: p.id,
        name: p.name,
        species_name: p.species_name ?? null,
    }));

    const totalChannels = deviceRes.data.channels_count ?? 4;
    const occupiedChannels = new Set(
        (deviceRes.data.plants as { soil_channel: number | null }[] | null ?? [])
            .map(p => p.soil_channel)
            .filter((ch): ch is number => ch !== null),
    );

    const freeChannels: number[] = [];
    for (let i = 1; i <= totalChannels; i++) {
        if (!occupiedChannels.has(i)) freeChannels.push(i);
    }

    return { disconnectedPlants, freeChannels };
}
