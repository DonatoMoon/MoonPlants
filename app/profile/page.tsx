// app/profile/page.tsx

import { createSupabaseServer } from '@/lib/supabase/server';
import PlantsSection from '@/components/profile/PlantsSection';
import BackgroundImageContainer from '@/components/layout/BackgroundImageContainer';
import Container from '@/components/layout/Container';
import LastMeasurementsSection from '@/components/profile/LastMeasurementsSection';
import backImg from "@/public/profileBackground.png";

export default async function ProfilePage() {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return <div className="text-center py-10">Please sign in to view your profile.</div>
    }

    // 1. Всі рослини користувача
    const { data: plants } = await supabase
        .from('plants')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const plantIds = (plants ?? []).map(p => p.id);

    // 2. Останній загальний вимір (air_temp, air_humidity, light)
    let lastMeasurement = null;
    if (plantIds.length > 0) {
        const { data } = await supabase
            .from('measurements')
            .select('air_temp, air_humidity, light, measured_at')
            .in('plant_id', plantIds)
            .order('measured_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        lastMeasurement = data;
    }

    // 3. Останні виміри вологості для всіх рослин
    const plantMoistureMap: Record<string, { soil_moisture: number; measured_at: string } | undefined> = {};
    if (plantIds.length > 0) {
        const { data: allMeasurements } = await supabase
            .from('measurements')
            .select('plant_id, soil_moisture, measured_at')
            .in('plant_id', plantIds)
            .order('measured_at', { ascending: false });

        for (const plantId of plantIds) {
            const found = allMeasurements?.find(m => m.plant_id === plantId);
            if (found) plantMoistureMap[plantId] = found;
        }
    }

    return (
        <BackgroundImageContainer src={backImg}>
            <Container className="items-center justify-center flex-1 ">
                {plantIds.length === 0 ? (
                    <div className="my-10 text-center text-white/80 text-3xl font-bold">
                        Add your first plant to start receiving live measurements!
                    </div>
                ) : (
                    <LastMeasurementsSection measurement={lastMeasurement} />
                )}

                <PlantsSection plants={plants ?? []} user_id={user.id} plantMoistureMap={plantMoistureMap} />

            </Container>
        </BackgroundImageContainer>
    );
}
