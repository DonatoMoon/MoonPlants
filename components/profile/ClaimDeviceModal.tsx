// components/profile/ClaimDeviceModal.tsx
'use client';

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ClaimDeviceForm from "./ClaimDeviceForm";

export default function ClaimDeviceModal({ open, onOpenChange, user_id }: { open: boolean, onOpenChange: (v: boolean) => void, user_id: string }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-transparent p-0 border-none">
                <Card>
                    <CardHeader>
                        <CardTitle>Підключити новий контролер</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ClaimDeviceForm
                            user_id={user_id}
                            onSuccess={() => onOpenChange(false)}
                        />
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    );
}
