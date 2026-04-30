'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sprout, Plus } from 'lucide-react';
import AddPlantModal from '@/components/profile/AddPlantModal';
import { PlantCard } from '@/components/profile/plants/PlantCard';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import { EmptyState } from '@/components/primitives/EmptyState';
import { GlassCard } from '@/components/primitives/GlassCard';

type Plant = {
    id: string;
    name: string;
    image_url?: string | null;
    last_watered_at?: string | null;
    device_id?: string | null;
    soil_channel?: number | null;
    devices?: { display_name?: string | null } | null;
};

type PlantMoisture = {
    soil_moisture_pct: number;
    measured_at: string;
};

type DeviceOption = { id: string; display_name: string | null; channels_count: number };

type PlantsSectionProps = {
    plants: Plant[];
    user_id: string;
    plantMoistureMap: Record<string, PlantMoisture | undefined>;
    devices?: DeviceOption[];
};

export default function PlantsSection({
    plants,
    user_id,
    plantMoistureMap,
    devices,
}: PlantsSectionProps) {
    const t = useTranslations('PlantsSection');
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const handleSuccess = () => {
        setOpen(false);
        router.refresh();
    };

    return (
        <section className="w-full mt-10" aria-labelledby="plants-heading">
            <SectionHeading
                title={t('title')}
                kicker={t('kicker')}
                description={
                    plants.length === 0
                        ? t('emptyDesc')
                        : t('count', { count: plants.length })
                }
                actions={
                    plants.length > 0 ? (
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => setOpen(true)}
                            className="rounded-full px-5 border-white/20 hover:bg-white/10 hover:border-white/40 transition-all duration-300"
                        >
                            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            {t('addPlant')}
                        </Button>
                    ) : null
                }
            />

            {plants.length === 0 ? (
                <GlassCard className="p-2">
                    <EmptyState
                        icon={Sprout}
                        title={t('emptyTitle')}
                        description={t('emptyLong')}
                        action={
                            <Button 
                                variant="default" 
                                className="mt-2 py-6 px-8 rounded-2xl border-white/20 hover:bg-white/10 hover:scale-[1.02] transition-all"
                                onClick={() => setOpen(true)}
                            >
                                <Plus className="mr-2 h-5 w-5" aria-hidden="true" />
                                {t('addFirst')}
                            </Button>
                        }
                    />
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 motion-safe:[--stagger:60ms]">
                    {plants.map((plant, i) => (
                        <div
                            key={plant.id}
                            style={{ animationDelay: `calc(var(--stagger) * ${i})`, animationFillMode: 'both' }}
                            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--dur-base)] flex justify-center"
                        >
                            <PlantCard plant={plant} lastMoisture={plantMoistureMap[plant.id]} />
                        </div>
                    ))}
                </div>
            )}

            <AddPlantModal
                open={open}
                onOpenChange={(v) => {
                    if (!v) handleSuccess();
                    else setOpen(v);
                }}
                user_id={user_id}
                devices={devices}
            />
        </section>
    );
}
