'use client';

import { useTranslations } from 'next-intl';
import { Calendar, Container as ContainerIcon, Droplet } from 'lucide-react';
import { BackgroundScene } from '@/components/layout/BackgroundScene';
import Container from '@/components/layout/Container';
import { GlassCard } from '@/components/primitives/GlassCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/primitives/Stat';
import { MLPredictionSkeleton } from '@/components/profile/skeletons';

export default function PlantDetailLoading() {
    const t = useTranslations('PlantDetail');
    return (
        <BackgroundScene variant="profile">
            <Container className="flex-1 py-8 md:py-12">
                <Skeleton className="h-5 w-64 mb-6 bg-[var(--glass-bg-strong)]" />

                <GlassCard className="p-6 md:p-8 mb-8">
                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                        <Skeleton className="w-44 h-44 rounded-[var(--radius-md)] bg-[var(--glass-bg-strong)]" />
                        <div className="flex flex-col gap-3 flex-1 w-full">
                            <Skeleton className="h-9 w-56 bg-[var(--glass-bg-strong)]" />
                            <Skeleton className="h-5 w-40 bg-[var(--glass-bg-strong)]" />
                            <Skeleton className="h-9 w-44 rounded-md bg-[var(--glass-bg-strong)]" />
                        </div>
                    </div>
                </GlassCard>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
                    <Stat
                        icon={Calendar}
                        label={t('ageStat')}
                        value={<Skeleton className="h-9 w-12 bg-[var(--glass-bg-strong)]" />}
                        unit={t('ageUnit')}
                    />
                    <Stat
                        icon={ContainerIcon}
                        label={t('potStat')}
                        value={<Skeleton className="h-9 w-20 bg-[var(--glass-bg-strong)]" />}
                        unit={t('potUnit')}
                    />
                    <Stat
                        icon={Droplet}
                        label={t('lastWateredStat')}
                        value={<Skeleton className="h-9 w-24 bg-[var(--glass-bg-strong)]" />}
                    />
                </div>

                <MLPredictionSkeleton />

                <Skeleton className="w-full h-72 rounded-[var(--radius-lg)] bg-[var(--glass-bg-strong)]" />
            </Container>
        </BackgroundScene>
    );
}
