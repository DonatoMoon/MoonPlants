// components/profile/AddPlantModal.tsx
'use client';

import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sprout } from "lucide-react";
import AddPlantForm from "@/components/profile/AddPlantForm";
import { getClaimedDevices } from "@/app/actions/iot/claimDevice";

type DeviceOption = { id: string; display_name: string | null; channels_count: number };

interface AddPlantModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    user_id: string;
    devices?: DeviceOption[];
}

export default function AddPlantModal({ open, onOpenChange, user_id, devices: devicesProp }: AddPlantModalProps) {
    const t = useTranslations('AddPlantForm');
    const [devices, setDevices] = useState<DeviceOption[]>(devicesProp ?? []);
    const [, startFetch] = useTransition();

    useEffect(() => {
        if (devicesProp) { setDevices(devicesProp); return; }
        if (open) {
            startFetch(async () => {
                const data = await getClaimedDevices(user_id);
                setDevices(data as DeviceOption[]);
            });
        }
    }, [open, user_id, devicesProp]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-md p-0 border-none overflow-hidden overflow-y-auto max-h-[90vh]"
                style={{
                    background: "#fff",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
                    borderRadius: 20,
                }}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>{t('modalTitle')}</DialogTitle>
                </DialogHeader>

                {/* Header */}
                <div className="flex items-center gap-3 px-6 pt-6 pb-0">
                    <div
                        className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                        style={{ background: "rgba(73,107,52,0.1)", border: "1px solid rgba(73,107,52,0.2)" }}
                    >
                        <Sprout className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold leading-none" style={{ color: "#1B2316" }}>
                            {t('modalTitle')}
                        </p>
                        <p className="text-xs mt-1 leading-none" style={{ color: "#8F95A5" }}>
                            {t('modalSubtitle')}
                        </p>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-6 mt-5" style={{ height: 1, background: "rgba(0,0,0,0.07)" }} />

                {/* Form */}
                <div className="px-6 pb-6 pt-4">
                    <AddPlantForm
                        user_id={user_id}
                        onSubmitPlant={() => onOpenChange(false)}
                        devices={devices}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
