'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Droplet, Lightbulb, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { waterPlantAction } from '@/app/actions/iot/waterPlant';
import { setLightAction } from '@/app/actions/iot/setLight';

interface PlantActionsProps {
    plantId: string;
    deviceId: string;
}

export function PlantActions({ plantId, deviceId }: PlantActionsProps) {
    const t = useTranslations('PlantActions');
    const [waterMl, setWaterMl] = useState(50);
    const [lightSec, setLightSec] = useState(60);
    const [isWatering, startWater] = useTransition();
    const [isLighting, startLight] = useTransition();

    const handleWater = () =>
        startWater(async () => {
            try {
                const result = await waterPlantAction({ plantId, waterMl });
                if (result?.warning) {
                    toast.warning(result.warning);
                } else {
                    toast.success(t('waterQueued'));
                }
            } catch (e) {
                toast.error(e instanceof Error ? e.message : t('waterError'));
            }
        });

    const handleLight = () =>
        startLight(async () => {
            try {
                await setLightAction({ deviceId, mode: 'on_for', durationSec: lightSec });
                toast.success(t('lightQueued'));
            } catch (e) {
                toast.error(e instanceof Error ? e.message : t('lightError'));
            }
        });

    return (
        <div className="flex flex-col gap-2 w-full mt-2 mb-2 bg-white/5 p-3 rounded-xl">
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    value={waterMl}
                    onChange={(e) => setWaterMl(Number(e.target.value))}
                    aria-label={t('waterVolumeLabel')}
                    min={1}
                    className="h-8 w-16 bg-white/10 border-0 text-white focus-visible:ring-1 focus-visible:ring-white/30"
                />
                <span className="text-xs text-white/70">{t('ml')}</span>
                <Button
                    onClick={handleWater}
                    disabled={isWatering}
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 bg-white/10 hover:bg-white/20 text-white border-0"
                    aria-label={t('waterAriaLabel')}
                >
                    {isWatering ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Droplet className="w-4 h-4 mr-1 text-blue-400" /> {t('water')}
                        </>
                    )}
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    value={lightSec}
                    onChange={(e) => setLightSec(Number(e.target.value))}
                    aria-label={t('lightDurationLabel')}
                    min={1}
                    className="h-8 w-16 bg-white/10 border-0 text-white focus-visible:ring-1 focus-visible:ring-white/30"
                />
                <span className="text-xs text-white/70">{t('sec')}</span>
                <Button
                    onClick={handleLight}
                    disabled={isLighting}
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 bg-white/10 hover:bg-white/20 text-white border-0"
                    aria-label={t('lightAriaLabel')}
                >
                    {isLighting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Lightbulb className="w-4 h-4 mr-1 text-yellow-400" /> {t('light')}
                        </>
                    )}
                </Button>
            </div>

        </div>
    );
}
