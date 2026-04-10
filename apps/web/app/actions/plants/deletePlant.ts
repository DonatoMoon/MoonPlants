// app/actions/plants/deletePlant.ts
'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function deletePlant(plantId: string) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase
        .from('plants')
        .delete()
        .eq('id', plantId);

    if (error) {
        throw new Error(error.message);
    }
    // Після видалення — на профіль
    redirect('/profile');
}
