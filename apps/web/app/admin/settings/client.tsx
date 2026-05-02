'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toggleCronSetting } from '@/app/actions/admin/toggleCron';
import { toast } from 'sonner';

export default function AdminSettingsClient({
    initialCronState,
}: {
    initialCronState: boolean;
}) {
    const [isPending, startTransition] = useTransition();
    const [cronEnabled, setCronEnabled] = useState(initialCronState);

    const handleToggle = (checked: boolean) => {
        setCronEnabled(checked);
        startTransition(async () => {
            try {
                await toggleCronSetting(checked);
                toast.success(
                    `Cron feature has been ${checked ? 'enabled' : 'disabled'}`
                );
            } catch (err: unknown) {
                // Revert state if failed
                setCronEnabled(!checked);
                toast.error('Failed to update cron setting');
            }
        });
    };

    return (
        <div className="space-y-6 max-w-lg">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage global app configurations.
                </p>
            </div>

            <div className="border rounded-lg p-6 bg-card/50 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-lg font-medium">Automatic ML Predictions (Cron)</Label>
                        <p className="text-sm text-muted-foreground">
                            Enable or disable the batch prediction chron job. Disable this to save on Railway bandwidth/limits.
                        </p>
                    </div>
                    <Switch
                        checked={cronEnabled}
                        onCheckedChange={handleToggle}
                        disabled={isPending}
                    />
                </div>
            </div>
        </div>
    );
}
