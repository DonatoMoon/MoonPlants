'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { connectPlant } from '@/app/actions/iot/claimDevice';
import { getConnectModalData, type ConnectModalData } from '@/app/actions/profile/getConnectModalData';
import { toast } from 'sonner';

interface ConnectPlantModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    deviceId: string;
    user_id: string;
    onSuccess: () => void;
}

export default function ConnectPlantModal({
    open,
    onOpenChange,
    deviceId,
    user_id,
    onSuccess,
}: ConnectPlantModalProps) {
    const t = useTranslations('ConnectPlant');
    const [data, setData] = useState<ConnectModalData | null>(null);
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');
    const [isFetching, startFetch] = useTransition();
    const [isConnecting, startConnect] = useTransition();

    useEffect(() => {
        if (open && deviceId) {
            startFetch(async () => {
                try {
                    const result = await getConnectModalData(deviceId);
                    setData(result);
                } catch {
                    toast.error(t('errorLoad'));
                }
            });
        }
        if (!open) {
            setData(null);
            setSelectedPlantId('');
            setSelectedChannel('');
        }
    }, [open, deviceId, t]);

    const handleConnect = () => {
        if (!selectedPlantId || !selectedChannel) {
            toast.error(t('errorSelect'));
            return;
        }
        startConnect(async () => {
            const res = await connectPlant(user_id, deviceId, selectedPlantId, parseInt(selectedChannel));
            if (res.success) {
                toast.success(t('successMsg'));
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(res.error ?? t('errorConnect'));
            }
        });
    };

    const plants = data?.disconnectedPlants ?? [];
    const channels = data?.freeChannels ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-white/60">{t('desc')}</p>

                    {isFetching ? (
                        <div className="text-center py-4 text-white/40">{t('loading')}</div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs text-white/40 uppercase font-medium">{t('plantLabel')}</label>
                                <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                        <SelectValue
                                            placeholder={
                                                plants.length > 0 ? t('selectPlant') : t('noPlants')
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-white/10 text-white">
                                        {plants.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                                {p.species_name ? ` (${p.species_name})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-white/40 uppercase font-medium">
                                    {t('channelLabel')}
                                </label>
                                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                        <SelectValue
                                            placeholder={
                                                channels.length > 0 ? t('selectChannel') : t('noChannels')
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-white/10 text-white">
                                        {channels.map((ch) => (
                                            <SelectItem key={ch} value={ch.toString()}>
                                                {t('channel', { ch })}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="bg-white/5 border-none hover:bg-white/10"
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleConnect}
                        disabled={isConnecting || isFetching || !selectedPlantId || !selectedChannel}
                        className="bg-accent hover:bg-accent/80 text-white"
                    >
                        {isConnecting ? t('connecting') : t('connect')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
