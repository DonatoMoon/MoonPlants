// apps/web/components/profile/MLPredictionCard.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Droplet, Brain, Clock, Sparkles, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { GlassCard } from '@/components/primitives/GlassCard';
import { Button } from '@/components/ui/button';
import { getMLPrediction } from '@/app/actions/predictions/getMLPrediction';
import { cn } from '@/lib/utils';

interface MLPredictionCardProps {
    plantId: string;
    initialPrediction: any | null;
}

export default function MLPredictionCard({ plantId, initialPrediction }: MLPredictionCardProps) {
    const t = useTranslations('MLPredictions');
    const [prediction, setPrediction] = useState(initialPrediction);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRefresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getMLPrediction(plantId);
            if (result.success) {
                setPrediction(result.data);
            } else {
                setError(result.error || t('error'));
            }
        } catch (err) {
            setError(t('error'));
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (hours: number) => {
        if (hours <= 0) return t('now');
        if (hours < 24) return t('hours', { hours: Math.round(hours) });
        const days = Math.floor(hours / 24);
        const remainingHours = Math.round(hours % 24);
        return t('days', { days, hours: remainingHours });
    };

    const details = prediction?.details as any;

    return (
        <GlassCard className="p-6 mb-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Brain size={120} />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                        <h2 className="text-xl font-semibold text-[var(--fg)]">
                            {t('title')}
                        </h2>
                    </div>
                    <p className="text-sm text-[var(--fg-muted)] max-w-md">
                        {t('description')}
                    </p>
                </div>
                <Button 
                    onClick={handleRefresh} 
                    disabled={loading}
                    variant="outline"
                    className="bg-[var(--glass-bg)] border-[var(--glass-border)] hover:bg-[var(--glass-bg-strong)] shrink-0"
                >
                    {loading ? (
                        <>
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            {t('refreshing')}
                        </>
                    ) : (
                        <>
                            <Brain className="mr-2 h-4 w-4" />
                            {t('refreshButton')}
                        </>
                    )}
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {!prediction && !loading && !error && (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-[var(--glass-bg-strong)] rounded-[var(--radius-md)] border border-dashed border-[var(--glass-border)]">
                    <Info className="h-8 w-8 text-[var(--fg-muted)] mb-2" />
                    <p className="text-[var(--fg-muted)] px-4">
                        {t('noData')}
                    </p>
                </div>
            )}

            {prediction && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    <div className="flex flex-col p-4 bg-[var(--glass-bg-strong)] rounded-[var(--radius-md)] border border-[var(--glass-border)]">
                        <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {t('timeToWater')}
                        </span>
                        <span className="text-2xl font-semibold text-[var(--fg)]">
                            {formatTime(details?.time_to_water_hours ?? 0)}
                        </span>
                    </div>

                    <div className="flex flex-col p-4 bg-[var(--glass-bg-strong)] rounded-[var(--radius-md)] border border-[var(--glass-border)]">
                        <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Droplet className="h-3.5 w-3.5" />
                            {t('recommendedAmount')}
                        </span>
                        <span className="text-2xl font-semibold text-[var(--fg)]">
                            {prediction.recommended_water_ml} <span className="text-base font-normal">ml</span>
                        </span>
                    </div>

                    <div className="flex flex-col p-4 bg-[var(--glass-bg-strong)] rounded-[var(--radius-md)] border border-[var(--glass-border)] sm:col-span-2 lg:col-span-1">
                        <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('confidence')}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className={cn(
                                "text-2xl font-semibold",
                                details?.confidence === "high" ? "text-green-400" : 
                                details?.confidence === "medium" ? "text-yellow-400" : "text-orange-400"
                            )}>
                                {details?.confidence?.toUpperCase() ?? "UNKNOWN"}
                            </span>
                            <div className="flex-1 h-2 bg-[var(--glass-border)] rounded-full overflow-hidden max-w-[100px]">
                                <div 
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        details?.confidence === "high" ? "bg-green-400 w-full" : 
                                        details?.confidence === "medium" ? "bg-yellow-400 w-2/3" : "bg-orange-400 w-1/3"
                                    )} 
                                />
                            </div>
                        </div>
                    </div>

                    {prediction.reason && (
                        <div className="sm:col-span-2 lg:col-span-3 p-4 bg-[var(--glass-bg-strong)]/50 rounded-[var(--radius-md)] border border-[var(--glass-border)]">
                            <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-2 block">
                                {t('rationale')}
                            </span>
                            <p className="text-sm leading-relaxed text-[var(--fg)] italic">
                                "{prediction.reason}"
                            </p>
                        </div>
                    )}
                </div>
            )}
        </GlassCard>
    );
}
