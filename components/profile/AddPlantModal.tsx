// components/profile/AddPlantModal.tsx
'use client';

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import AddPlantForm from "@/components/profile/AddPlantForm";
import { getClaimedDevices } from "@/app/actions/iot/claimDevice";

export default function AddPlantModal({ open, onOpenChange, user_id }: { open: boolean, onOpenChange: (v: boolean) => void, user_id: string }) {
    const [devices, setDevices] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            getClaimedDevices(user_id).then(setDevices);
        }
    }, [open, user_id]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-transparent p-0 border-none overflow-y-auto max-h-[90vh]">
                <Card>
                    <CardHeader>
                        <CardTitle>Додати нову рослину</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AddPlantForm
                            user_id={user_id}
                            onSubmitPlant={() => onOpenChange(false)}
                            devices={devices}
                        />
                    </CardContent>
                    <CardFooter />
                </Card>
            </DialogContent>
        </Dialog>
    );
}
