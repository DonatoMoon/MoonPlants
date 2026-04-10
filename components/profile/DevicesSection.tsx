// components/profile/DevicesSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Plus, Unplug, ArrowLeftRight } from 'lucide-react';
import ClaimDeviceModal from './ClaimDeviceModal';
import SwapChannelsModal from './SwapChannelsModal';
import { getClaimedDevices, unclaimDevice } from '@/app/actions/iot/claimDevice';
import { toast } from 'sonner';
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
} from "@/components/ui/alert-dialog";

type Device = {
    id: string;
    display_name: string | null;
    status: string;
    channels_count: number;
    last_seen_at: string | null;
};

export default function DevicesSection({ user_id }: { user_id: string }) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [openModal, setOpenModal] = useState(false);
    const [openSwapModal, setOpenSwapModal] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);

    const fetchDevices = async () => {
        setIsLoading(true);
        const data = await getClaimedDevices(user_id);
        setDevices(data as Device[]);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchDevices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user_id]);

    const handleSuccess = () => {
        fetchDevices();
        setOpenModal(false);
    };

    const handleUnclaim = async (deviceId: string) => {
        const res = await unclaimDevice(user_id, deviceId);
        if (res.success) {
            toast.success("Успішно", { description: "Пристрій від'єднано" });
            fetchDevices();
        } else {
            toast.error("Помилка", { description: res.error });
        }
    };

    const openSwap = (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        setOpenSwapModal(true);
    };

    return (
        <section className="w-full mt-10">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Ваші пристрої</h2>
                <Button variant="outline" size="sm" onClick={() => setOpenModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Підключити
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-4">Завантаження...</div>
            ) : devices.length === 0 ? (
                <Card className="bg-white/10 border-white/20">
                    <CardContent className="py-10 text-center">
                        <Smartphone className="mx-auto h-12 w-12 text-white/40 mb-4" />
                        <p className="text-white/60">У вас поки немає підключених контролерів.</p>
                        <Button variant="link" onClick={() => setOpenModal(true)} className="text-white mt-2">
                            Підключити перший пристрій
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map(device => (
                        <Card key={device.id} className="bg-white/10 border-white/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    <span className="truncate">{device.display_name || `Контролер ${device.id.slice(0, 8)}`}</span>
                                    <Smartphone className="h-4 w-4 text-white/60" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-1 text-white/80">
                                    <p>Статус: <span className="text-green-400">{device.status}</span></p>
                                    <p>Каналів: {device.channels_count}</p>
                                    <p className="text-xs text-white/40">
                                        ID: {device.id}
                                    </p>
                                    {device.last_seen_at && (
                                        <p className="text-xs text-white/40">
                                            Востаннє онлайн: {new Date(device.last_seen_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <div className="mt-4 flex flex-col gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full bg-white/5 border-white/10 hover:bg-white/10"
                                        onClick={() => openSwap(device.id)}
                                    >
                                        <ArrowLeftRight className="mr-2 h-4 w-4" /> Поміняти канали
                                    </Button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm" className="w-full">
                                                <Unplug className="mr-2 h-4 w-4" /> Від&apos;єднати
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="bg-slate-900 border-white/20 text-white">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Ви впевнені?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-white/60">
                                                    Це від&apos;єднає контролер від вашого акаунту. Усі рослини залишаться, але не будуть отримувати дані з датчиків, доки ви не підключите їх до нового пристрою.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="bg-white/10 border-none hover:bg-white/20 text-white">Скасувати</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => handleUnclaim(device.id)}
                                                    className="bg-red-600 hover:bg-red-700 text-white"
                                                >
                                                    Від&apos;єднати
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ClaimDeviceModal
                open={openModal}
                onOpenChange={setOpenModal}
                user_id={user_id}
                onSuccess={handleSuccess}
            />

            <SwapChannelsModal
                open={openSwapModal}
                onOpenChange={setOpenSwapModal}
                deviceId={selectedDeviceId}
                user_id={user_id}
                onSuccess={fetchDevices}
            />
        </section>
    );
}
