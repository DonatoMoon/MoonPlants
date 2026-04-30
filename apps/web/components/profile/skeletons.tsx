'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard } from '@/components/primitives/GlassCard';
import { SectionHeading } from '@/components/primitives/SectionHeading';

export function MLPredictionSkeleton() {
    const t = useTranslations('MLPredictions');
    return (
        <GlassCard className="p-6 mb-8 overflow-hidden relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-[var(--fg)]">{t('title')}</h2>
                    <p className="text-sm text-[var(--fg-muted)] max-w-md mt-1">{t('description')}</p>
                </div>
                <Skeleton className="h-9 w-36 rounded-md bg-[var(--glass-bg-strong)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-[var(--radius-md)] bg-[var(--glass-bg-strong)]" />
                ))}
            </div>
        </GlassCard>
    );
}

export function MeasurementsSkeleton() {
    const t = useTranslations('LastMeasurements');
    return (
        <section className="w-full mt-6 mb-10" aria-busy="true" aria-label={t('title')}>
            <SectionHeading
                title={t('title')}
                kicker={t('kicker')}
                description={' '}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {[0, 1, 2].map((i) => (
                    <GlassCard key={i} className="p-5">
                        <Skeleton className="h-3 w-20 mb-3 bg-[var(--glass-bg-strong)]" />
                        <Skeleton className="h-8 w-24 bg-[var(--glass-bg-strong)]" />
                    </GlassCard>
                ))}
            </div>
        </section>
    );
}

export function DevicesSectionSkeleton() {
    const t = useTranslations('DevicesSection');
    return (
        <section className="w-full mt-10" aria-busy="true" aria-label={t('title')}>
            <SectionHeading
                title={t('title')}
                kicker={t('kicker')}
                description={' '}
                actions={<Skeleton className="h-9 w-32 rounded-full bg-[var(--glass-bg-strong)]" />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-44 rounded-[var(--radius-lg)] bg-[var(--glass-bg-strong)]" />
                ))}
            </div>
        </section>
    );
}

export function PlantsGridSkeleton() {
    const t = useTranslations('PlantsSection');
    return (
        <section className="w-full mt-10" aria-busy="true" aria-label={t('title')}>
            <SectionHeading
                title={t('title')}
                kicker={t('kicker')}
                description={' '}
                actions={<Skeleton className="h-9 w-36 rounded-full bg-[var(--glass-bg-strong)]" />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-72 rounded-[var(--radius-lg)] bg-[var(--glass-bg-strong)]" />
                ))}
            </div>
        </section>
    );
}
