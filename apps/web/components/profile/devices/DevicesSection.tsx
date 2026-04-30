'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import { EmptyState } from '@/components/primitives/EmptyState';
import { GlassCard } from '@/components/primitives/GlassCard';
import { DeviceCard, type DeviceData } from './DeviceCard';
import ClaimDeviceModal from '@/components/profile/ClaimDeviceModal';
import SwapChannelsModal from '@/components/profile/SwapChannelsModal';
import ConnectPlantModal from '@/components/profile/ConnectPlantModal';

interface DevicesSectionProps {
    devices: DeviceData[];
    userId: string;
}

export function DevicesSection({ devices, userId }: DevicesSectionProps) {
    const t = useTranslations('DevicesSection');
    const router = useRouter();
    const [openClaim, setOpenClaim] = useState(false);
    const [openSwap, setOpenSwap] = useState(false);
    const [openConnect, setOpenConnect] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');

    const handleSuccess = () => router.refresh();

    const handleOpenConnect = (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        setOpenConnect(true);
    };

    const handleOpenSwap = (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        setOpenSwap(true);
    };

    return (
        <section className="w-full mt-10" aria-labelledby="devices-heading">
            <SectionHeading
                title={t('title')}
                kicker={t('kicker')}
                description={
                    devices.length === 0
                        ? t('emptyDesc')
                        : t('count', { count: devices.length })
                }
                actions={
                    devices.length > 0 ? (
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => setOpenClaim(true)}
                            className="rounded-full px-5 border-white/20 hover:bg-white/10 hover:border-white/40 transition-all duration-300"
                        >
                            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            {t('addDevice')}
                        </Button>
                    ) : null
                }
            />

            {devices.length === 0 ? (
                <GlassCard className="p-2">
                    <EmptyState
                        icon={Smartphone}
                        title={t('emptyTitle')}
                        description={t('emptyLong')}
                        action={
                            <Button 
                                variant="default" 
                                className="mt-2 py-6 px-8 rounded-2xl border-white/20 hover:bg-white/10 hover:scale-[1.02] transition-all"
                                onClick={() => setOpenClaim(true)}
                            >
                                <Plus className="mr-2 h-5 w-5" aria-hidden="true" />
                                {t('addFirst')}
                            </Button>
                        }
                    />
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 motion-safe:[--stagger:80ms]">
                    {devices.map((device, i) => (
                        <div
                            key={device.id}
                            style={{ animationDelay: `calc(var(--stagger) * ${i})`, animationFillMode: 'both' }}
                            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-[var(--dur-base)]"
                        >
                            <DeviceCard
                                device={device}
                                userId={userId}
                                onOpenConnect={handleOpenConnect}
                                onOpenSwap={handleOpenSwap}
                            />
                        </div>
                    ))}
                </div>
            )}

            <ClaimDeviceModal
                open={openClaim}
                onOpenChange={setOpenClaim}
                user_id={userId}
                onSuccess={handleSuccess}
            />

            <SwapChannelsModal
                open={openSwap}
                onOpenChange={setOpenSwap}
                deviceId={selectedDeviceId}
                user_id={userId}
                onSuccess={handleSuccess}
            />

            <ConnectPlantModal
                open={openConnect}
                onOpenChange={setOpenConnect}
                deviceId={selectedDeviceId}
                user_id={userId}
                onSuccess={handleSuccess}
            />
        </section>
    );
}
