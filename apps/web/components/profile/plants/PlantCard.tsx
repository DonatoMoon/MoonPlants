'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Unplug, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/primitives/GlassCard';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { PlantActions } from './PlantActions';

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

interface PlantCardProps {
    plant: Plant;
    lastMoisture?: PlantMoisture;
}

export function PlantCard({ plant, lastMoisture }: PlantCardProps) {
    const t = useTranslations('PlantsSection');
    const locale = useLocale();
    const isDisconnected = !plant.device_id;
    const deviceName = plant.devices?.display_name || t('disconnected');

    return (
        <GlassCard
            hoverable
            className="p-4 flex flex-col items-center w-full max-w-xs relative overflow-hidden"
        >
            <div className="absolute top-3 right-3 z-10">
                {isDisconnected ? (
                    <StatusBadge status="error" pulse>
                        <Unplug className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{t('disconnected')}</span>
                    </StatusBadge>
                ) : (
                    <StatusBadge status="info">
                        <Cpu className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="flex items-center min-w-0">
                            <span className="truncate max-w-[80px] sm:max-w-[120px]">
                                {deviceName}
                            </span>
                            <span className="shrink-0 whitespace-nowrap ml-1">
                                · {t('channel')} {plant.soil_channel}
                            </span>
                        </span>
                    </StatusBadge>
                )}
            </div>

            {plant.image_url && (
                <Image
                    src={plant.image_url}
                    alt={plant.name}
                    width={120}
                    height={120}
                    sizes="120px"
                    className="rounded-[var(--radius-md)] object-cover mb-3 mt-6"
                    draggable={false}
                />
            )}

            <h3 className="font-display text-xl font-semibold mb-2 text-center text-[var(--fg)]">
                {plant.name}
            </h3>

            <div className="text-[var(--fg-muted)] text-sm mb-1">
                {t('soilMoisture')}{' '}
                {lastMoisture ? (
                    <span className="font-semibold text-[var(--fg)]">
                        {Math.round(lastMoisture.soil_moisture_pct)}%
                    </span>
                ) : (
                    <span>—</span>
                )}
            </div>
            <div className="text-[var(--fg-subtle)] text-xs mb-2">
                {t('lastWatered')}{' '}
                {plant.last_watered_at
                    ? new Date(plant.last_watered_at).toLocaleDateString(locale)
                    : '—'}
            </div>

            {!isDisconnected && plant.device_id && (
                <PlantActions plantId={plant.id} deviceId={plant.device_id} />
            )}

            <div className="mt-2 w-full">
                <Button
                    asChild
                    variant="outline"
                    className="w-full bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-strong)] border-[var(--glass-border)]"
                >
                    <Link href={`/profile/${plant.id}`}>{t('details')}</Link>
                </Button>
            </div>
        </GlassCard>
    );
}
