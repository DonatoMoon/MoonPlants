import { createSupabaseServer } from '@/lib/supabase/server';
import AdminSettingsClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
    const supabase = await createSupabaseServer();

    // Fetch current app setting (assume ID 1 exists thanks to our migration)
    const { data } = await supabase
        .from('app_settings')
        .select('is_cron_enabled')
        .eq('id', 1)
        .single();

    const isCronEnabled = data?.is_cron_enabled ?? true;

    return (
        <div className="p-8 max-w-4xl mx-auto mt-12 w-full">
            <AdminSettingsClient initialCronState={isCronEnabled} />
        </div>
    );
}
