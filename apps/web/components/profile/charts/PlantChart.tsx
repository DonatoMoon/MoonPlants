'use client';

import { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/primitives/GlassCard';
import { chartTheme, seriesColor, chartSeries, type ChartSeriesKey } from './chart-tokens';

export type DataPoint = { time: string } & Record<ChartSeriesKey, number>;

type PlantChartProps = {
    data: DataPoint[];
    dataKey: ChartSeriesKey;
};

export default function PlantChart({ data, dataKey }: PlantChartProps) {
    const { resolvedTheme } = useTheme();
    const meta = chartSeries[dataKey];
    const [tokens, setTokens] = useState(() => chartTheme());
    const [color, setColor] = useState(() => seriesColor(dataKey));

    useEffect(() => {
        setTokens(chartTheme());
        setColor(seriesColor(dataKey));
    }, [resolvedTheme, dataKey]);

    return (
        <GlassCard className="w-full p-4">
            <h3 className={cn(
                "mb-3 font-display text-base font-semibold text-center",
                meta.tailwindColor
            )}>
                {meta.name}{' '}
                <span className="opacity-70 text-xs">({meta.unit})</span>
            </h3>

            {data.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-sm text-[var(--fg-muted)]">
                    Немає даних для цього діапазону
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 8, left: -10, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} />
                        <XAxis
                            dataKey="time"
                            tick={{ fill: tokens.fgMuted, fontSize: 11 }}
                            stroke={tokens.border}
                        />
                        <YAxis
                            tick={{ fill: tokens.fgMuted, fontSize: 11 }}
                            stroke={tokens.border}
                            width={40}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tokens.popover,
                                border: `1px solid ${tokens.border}`,
                                borderRadius: 12,
                                color: tokens.fg,
                                fontSize: 12,
                            }}
                            labelStyle={{ color: tokens.fg }}
                            itemStyle={{ color: tokens.fg }}
                            formatter={(value: number) => [`${value} ${meta.unit}`, meta.name]}
                        />
                        <Line
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                            isAnimationActive={typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </GlassCard>
    );
}
