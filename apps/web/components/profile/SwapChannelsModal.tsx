'use client';

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { swapChannels } from "@/app/actions/iot/claimDevice";
import { toast } from "sonner";

type Plant = {
    id: string;
    name: string;
    soil_channel: number;
};

interface SwapChannelsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    deviceId: string;
    user_id: string;
    onSuccess: () => void;
}

export default function SwapChannelsModal({
    open,
    onOpenChange,
    deviceId,
    user_id,
    onSuccess,
}: SwapChannelsModalProps) {
    const t = useTranslations('SwapChannels');
    const [plants, setPlants] = useState<Plant[]>([]);
    const [p1, setP1] = useState<string>("");
    const [p2, setP2] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && deviceId) {
            fetch(`/api/v1/devices/${deviceId}`)
                .then(res => res.json())
                .then(data => {
                    const linkedPlants = (data.plants || []).filter((p: { soil_channel: number | null }) => p.soil_channel !== null);
                    setPlants(linkedPlants);
                });
        }
    }, [open, deviceId]);

    const handleSwap = async () => {
        if (!p1 || !p2 || p1 === p2) {
            toast.error(t('errorSelectTwo'));
            return;
        }

        setIsLoading(true);
        const res = await swapChannels(user_id, deviceId, p1, p2);
        setIsLoading(false);

        if (res.success) {
            toast.success(t('successTitle'), { description: t('successDesc') });
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(t('errorTitle'), { description: res.error });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-white/60">{t('desc')}</p>

                    <div className="space-y-2">
                        <label className="text-xs text-white/40 uppercase">{t('plant1')}</label>
                        <Select value={p1} onValueChange={setP1}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder={t('selectPlant')} />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-white/10 text-white">
                                {plants.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name} ({t('channel', { ch: p.soil_channel })})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-white/40 uppercase">{t('plant2')}</label>
                        <Select value={p2} onValueChange={setP2}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder={t('selectPlant')} />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-white/10 text-white">
                                {plants.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name} ({t('channel', { ch: p.soil_channel })})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-white/5 border-none hover:bg-white/10">
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleSwap}
                        disabled={isLoading || !p1 || !p2 || p1 === p2}
                        className="bg-accent hover:bg-accent/80 text-white"
                    >
                        {isLoading ? t('swapping') : t('swap')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
