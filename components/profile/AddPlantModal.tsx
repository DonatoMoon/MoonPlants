// components/profile/AddPlantModal.tsx
'use client';

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import AddPlantForm from "@/components/profile/AddPlantForm";

export default function AddPlantModal({ open, onOpenChange, user_id }: { open: boolean, onOpenChange: (v: boolean) => void, user_id: string }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-transparent p-0 border-none">
                <Card>
                    <CardHeader>
                        <CardTitle>Додати нову рослину</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AddPlantForm
                            user_id={user_id}
                            onSubmitPlant={() => onOpenChange(false)}
                        />
                    </CardContent>
                    <CardFooter />
                </Card>
            </DialogContent>
        </Dialog>
    );
}
