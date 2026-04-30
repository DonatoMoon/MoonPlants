// app/actions/plants/deletePlant.ts
'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppError } from '@/lib/errors';

export async function deletePlant(plantId: string) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new AppError('unauthorized', 'Не авторизовано', 401);

    const { data: plant } = await supabase
        .from('plants')
        .select('owner_user_id')
        .eq('id', plantId)
        .maybeSingle();

    if (!plant) throw new AppError('not_found', 'Рослину не знайдено', 404);
    if (plant.owner_user_id !== user.id) throw new AppError('forbidden', 'Немає доступу', 403);

    const { error } = await supabase.from('plants').delete().eq('id', plantId);
    if (error) throw new Error(error.message);

    redirect('/profile');
}
