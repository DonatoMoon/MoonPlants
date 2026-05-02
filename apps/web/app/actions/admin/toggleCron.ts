'use server';

import { createSupabaseServer } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function toggleCronSetting(isEnabled: boolean) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    // Verify user is authenticated (ideally an admin check should be here too)
    if (!user) {
        throw new Error('Unauthorized');
    }

    const adminClient = createSupabaseAdmin();

    // Update the single row in app_settings table using admin rights
    const { error } = await adminClient
        .from('app_settings')
        .upsert({ id: 1, is_cron_enabled: isEnabled, updated_at: new Date().toISOString() });

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath('/admin/settings');
    revalidatePath('/'); // Optional, depending on where else it's used

    return { success: true, is_cron_enabled: isEnabled };
}
