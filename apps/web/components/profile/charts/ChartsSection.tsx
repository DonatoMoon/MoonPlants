'use client';

import { useMemo, useState } from 'react';
import { isAfter, isBefore } from 'date-fns';
import PlantChart, { type DataPoint } from './PlantChart';
import { chartSeriesKeys } from './chart-tokens';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { GlassCard } from '@/components/primitives/GlassCard';
import { LineChart } from 'lucide-react';
import { EmptyState } from '@/components/primitives/EmptyState';

type Measurement = {
    measured_at: string;
    soil_moisture_pct: number;
    air_humidity_pct: number;
    air_temp_c: number;
    light_lux: number;
};

export default function ChartsSection({ measurements }: { measurements: Measurement[] }) {
    const allDates = (measurements?.length
        ? measurements
        : [
              {
                  measured_at: new Date().toISOString(),
                  soil_moisture_pct: 0,
                  air_humidity_pct: 0,
                  air_temp_c: 0,
                  light_lux: 0,
              },
          ]
    ).map((m) => new Date(m.measured_at));

    const minDate = allDates.reduce((a, b) => (a < b ? a : b), allDates[0]);
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b), allDates[0]);

    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: minDate,
        to: maxDate,
    });

    const filtered = useMemo(() => {
        if (!measurements?.length) return [];
        return measurements.filter((m) => {
            const d = new Date(m.measured_at);
            return (
                (!dateRange.from || !isBefore(d, dateRange.from)) &&
                (!dateRange.to || !isAfter(d, dateRange.to))
            );
        });
    }, [measurements, dateRange]);

    const data: DataPoint[] = filtered.map((m) => ({
        time: new Date(m.measured_at).toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit',
        }),
        soil_moisture: m.soil_moisture_pct,
        air_humidity: m.air_humidity_pct,
        air_temp: m.air_temp_c,
        light: m.light_lux,
    }));

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="w-full max-w-md mx-auto mb-4">
                <DateRangePicker
                    from={dateRange.from}
                    to={dateRange.to}
                    onUpdate={({ from, to }) =>
                        setDateRange({ from: from ?? minDate, to: to ?? maxDate })
                    }
                    min={minDate}
                    max={maxDate}
                />
            </div>

            {data.length === 0 ? (
                <GlassCard className="p-2">
                    <EmptyState
                        icon={LineChart}
                        title="Немає даних"
                        description="У вибраному діапазоні немає вимірювань. Спробуйте інший період."
                    />
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                    {chartSeriesKeys.map((key) => (
                        <PlantChart key={key} data={data} dataKey={key} />
                    ))}
                </div>
            )}
        </div>
    );
}
