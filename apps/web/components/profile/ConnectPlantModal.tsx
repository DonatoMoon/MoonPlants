'use client';

import { useState, useEffect, useCallback } from "react";
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
import { connectPlant } from "@/app/actions/iot/claimDevice";
import { toast } from "sonner";

type DisconnectedPlant = {
    id: string;
    name: string;
    species_name: string;
};

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
    const [disconnectedPlants, setDisconnectedPlants] = useState<DisconnectedPlant[]>([]);
    const [availableChannels, setAvailableChannels] = useState<number[]>([]);
    const [selectedPlantId, setSelectedPlantId] = useState<string>("");
    const [selectedChannel, setSelectedChannel] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        try {
            // 1. Get disconnected plants
            const plantsRes = await fetch("/api/v1/plants/disconnected");
            const plantsData = await plantsRes.json();
            setDisconnectedPlants(plantsData.plants || []);

            // 2. Get device info to find occupied channels
            const deviceRes = await fetch(`/api/v1/devices/${deviceId}`);
            const deviceData = await deviceRes.json();
            
            const totalChannels = deviceData.device?.channels_count || 4;
            const occupiedChannels = (deviceData.plants || []).map((p: { soil_channel: number | null }) => p.soil_channel);
            
            const free: number[] = [];
            for (let i = 1; i <= totalChannels; i++) {
                if (!occupiedChannels.includes(i)) {
                    free.push(i);
                }
            }
            setAvailableChannels(free);
        } catch (err) {
            console.error("Failed to fetch data for connection:", err);
            toast.error("Помилка завантаження даних");
        } finally {
            setIsFetching(false);
        }
    }, [deviceId]);

    useEffect(() => {
        if (open && deviceId) {
            fetchData();
        }
    }, [open, deviceId, fetchData]);

    const handleConnect = async () => {
        if (!selectedPlantId || !selectedChannel) {
            toast.error("Помилка", { description: "Оберіть рослину та канал" });
            return;
        }

        setIsLoading(true);
        const res = await connectPlant(user_id, deviceId, selectedPlantId, parseInt(selectedChannel));
        setIsLoading(false);

        if (res.success) {
            toast.success("Успішно", { description: "Рослину підключено до контролера" });
            onSuccess();
            onOpenChange(false);
            setSelectedPlantId("");
            setSelectedChannel("");
        } else {
            toast.error("Помилка", { description: res.error });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-white/20 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Підключення рослини</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-white/60">
                        Оберіть одну з ваших непідключених рослин та вільний канал на цьому пристрої.
                    </p>
                    
                    {isFetching ? (
                        <div className="text-center py-4 text-white/40">Завантаження...</div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs text-white/40 uppercase font-medium">Рослина</label>
                                <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                        <SelectValue placeholder={disconnectedPlants.length > 0 ? "Оберіть рослину" : "Немає вільних рослин"} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-white/10 text-white">
                                        {disconnectedPlants.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name} ({p.species_name})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-white/40 uppercase font-medium">Вільний канал</label>
                                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                        <SelectValue placeholder={availableChannels.length > 0 ? "Оберіть канал" : "Немає вільних каналів"} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-white/10 text-white">
                                        {availableChannels.map(ch => (
                                            <SelectItem key={ch} value={ch.toString()}>
                                                Канал {ch}
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
                        Скасувати
                    </Button>
                    <Button 
                        onClick={handleConnect} 
                        disabled={isLoading || isFetching || !selectedPlantId || !selectedChannel}
                        className="bg-accent hover:bg-accent/80 text-white"
                    >
                        {isLoading ? "Підключаємо..." : "Підключити"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
