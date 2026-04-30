// app/profile/page.tsx
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PlantsSection from '@/components/profile/plants/PlantsSection';
import { DevicesSection } from '@/components/profile/devices/DevicesSection';
import LastMeasurementsSection from '@/components/profile/measurements/LastMeasurementsSection';
import { BackgroundScene } from '@/components/layout/BackgroundScene';
import Container from '@/components/layout/Container';
import { PageHeader } from '@/components/primitives/PageHeader';
import { IoTService } from '@/lib/services/iot.service';
import { getTranslations } from 'next-intl/server';
import {
    MeasurementsSkeleton,
    DevicesSectionSkeleton,
    PlantsGridSkeleton,
} from '@/components/profile/skeletons';

export default async function ProfilePage() {
    const t = await getTranslations('ProfilePage');
    const supabase = await createSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/?auth=signin');

    return (
        <BackgroundScene variant="profile">
            <Container className="flex-1 py-8 md:py-12">
                <PageHeader
                    title={t('title')}
                    subtitle={t('subtitle')}
                />

                <Suspense fallback={<MeasurementsSkeleton />}>
                    <MeasurementsLoader userId={user.id} />
                </Suspense>

                <Suspense fallback={<DevicesSectionSkeleton />}>
                    <DevicesLoader userId={user.id} />
                </Suspense>

                <Suspense fallback={<PlantsGridSkeleton />}>
                    <PlantsLoader userId={user.id} />
                </Suspense>
            </Container>
        </BackgroundScene>
    );
}

async function MeasurementsLoader({ userId }: { userId: string }) {
    const supabase = await createSupabaseServer();
    const { data: plantRows } = await supabase
        .from('plants')
        .select('id')
        .eq('owner_user_id', userId);

    const plantIds = plantRows?.map((p) => p.id) ?? [];
    if (plantIds.length === 0) return null;

    const { data: measurement } = await supabase
        .from('measurements')
        .select('air_temp_c, air_humidity_pct, light_lux, measured_at')
        .in('plant_id', plantIds)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return <LastMeasurementsSection measurement={measurement} />;
}

async function DevicesLoader({ userId }: { userId: string }) {
    const devices = await IoTService.getClaimedDevices(userId);
    return <DevicesSection devices={devices} userId={userId} />;
}

async function PlantsLoader({ userId }: { userId: string }) {
    const supabase = await createSupabaseServer();
    const [plantsRes, devices] = await Promise.all([
        supabase
            .from('plants')
            .select('*, devices (display_name)')
            .eq('owner_user_id', userId)
            .order('created_at', { ascending: false }),
        IoTService.getClaimedDevices(userId),
    ]);

    const plants = plantsRes.data ?? [];
    const plantIds = plants.map((p) => p.id);

    const allMoisture =
        plantIds.length > 0
            ? ((
                  await supabase
                      .from('measurements')
                      .select('plant_id, soil_moisture_pct, measured_at')
                      .in('plant_id', plantIds)
                      .order('measured_at', { ascending: false })
              ).data ?? [])
            : ([] as { plant_id: string; soil_moisture_pct: number; measured_at: string }[]);

    const plantMoistureMap: Record<
        string,
        { soil_moisture_pct: number; measured_at: string } | undefined
    > = {};
    for (const id of plantIds) {
        plantMoistureMap[id] = allMoisture.find((m) => m.plant_id === id);
    }

    const deviceOptions = devices.map((d) => ({
        id: d.id,
        display_name: d.display_name,
        channels_count: d.channels_count,
    }));

    return (
        <PlantsSection
            plants={plants}
            user_id={userId}
            plantMoistureMap={plantMoistureMap}
            devices={deviceOptions}
        />
    );
}
