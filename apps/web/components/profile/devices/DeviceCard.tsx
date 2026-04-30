'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Smartphone, Unplug, ArrowLeftRight, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/primitives/GlassCard';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { unclaimDevice } from '@/app/actions/iot/claimDevice';

export type DeviceData = {
    id: string;
    display_name: string | null;
    status: string;
    channels_count: number;
    last_seen_at: string | null;
};

interface DeviceCardProps {
    device: DeviceData;
    userId: string;
    onOpenConnect: (deviceId: string) => void;
    onOpenSwap: (deviceId: string) => void;
}

export function DeviceCard({ device, userId, onOpenConnect, onOpenSwap }: DeviceCardProps) {
    const t = useTranslations('DevicesSection');
    const locale = useLocale();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleUnclaim = () =>
        startTransition(async () => {
            const res = await unclaimDevice(userId, device.id);
            if (res.success) {
                toast.success(t('disconnectedSuccess'));
                router.refresh();
            } else {
                toast.error(res.error ?? t('disconnectedError'));
            }
        });

    const isOnline = device.status === 'claimed';
    const label = device.display_name || `${t('controllerFallback')} ${device.id.slice(0, 8)}`;

    return (
        <GlassCard hoverable className="overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="h-4 w-4 text-[var(--fg-muted)] shrink-0" aria-hidden="true" />
                    <span className="font-semibold truncate text-[var(--fg)]">{label}</span>
                </div>
                <StatusBadge status={isOnline ? 'online' : 'offline'} pulse={isOnline}>
                    {isOnline ? t('online') : device.status}
                </StatusBadge>
            </div>

            <div className="p-4 space-y-1 text-sm text-[var(--fg-muted)] flex-1">
                <p>
                    {t('channels')} <span className="text-[var(--fg)] font-medium">{device.channels_count}</span>
                </p>
                <p className="text-xs text-[var(--fg-subtle)] truncate" title={device.id}>
                    ID: {device.id}
                </p>
                {device.last_seen_at && (
                    <p className="text-xs text-[var(--fg-subtle)]">
                        {t('lastSeen')} {new Date(device.last_seen_at).toLocaleString(locale)}
                    </p>
                )}
            </div>

            <div className="p-4 pt-0 flex flex-col gap-2">
                <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 transition-all text-white/90"
                    onClick={() => onOpenConnect(device.id)}
                >
                    <LinkIcon className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('connectPlant')}
                </Button>

                <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 transition-all text-white/90"
                    onClick={() => onOpenSwap(device.id)}
                >
                    <ArrowLeftRight className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('swapChannels')}
                </Button>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="w-full" disabled={isPending}>
                            <Unplug className="mr-2 h-4 w-4" aria-hidden="true" />
                            {isPending ? t('disconnecting') : t('disconnect')}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('disconnectConfirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('disconnectConfirmDesc')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleUnclaim}>
                                {t('disconnect')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </GlassCard>
    );
}
