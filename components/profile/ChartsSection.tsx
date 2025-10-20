'use client';

import PlantChart from './PlantChart';
import { useState, useMemo } from 'react';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { addDays, isAfter, isBefore, parseISO } from 'date-fns';

type Measurement = {
    measured_at: string;
    soil_moisture: number;
    air_humidity: number;
    air_temp: number;
    light: number;
};

export default function ChartsSection({ measurements }: { measurements: Measurement[] }) {
    if (!measurements || measurements.length === 0) {
        return <div>No data to display.</div>;
    }

    // 1. Визначаємо мін/макс дату
    const allDates = measurements.map(m => new Date(m.measured_at));
    const minDate = allDates.reduce((a, b) => a < b ? a : b, allDates[0]);
    const maxDate = allDates.reduce((a, b) => a > b ? a : b, allDates[0]);

    // 2. Стейт для діапазону (по замовчуванню — всі дати)
    const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>({
        from: minDate,
        to: maxDate,
    });

    // 3. Фільтровані вимірювання
    const filtered = useMemo(() => {
        return measurements.filter(m => {
            const d = new Date(m.measured_at);
            return (!dateRange.from || !isBefore(d, dateRange.from))
                && (!dateRange.to || !isAfter(d, dateRange.to));
        });
    }, [measurements, dateRange]);

    // 4. Готуємо дані
    const data = filtered.map(m => ({
        time: new Date(m.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        soil_moisture: m.soil_moisture,
        air_humidity: m.air_humidity,
        air_temp: m.air_temp,
        light: m.light,
    }));

    const chartConfigs = [
        { key: 'soil_moisture', name: 'Soil Moisture', color: '#2563eb' },
        { key: 'air_humidity', name: 'Air Humidity', color: '#0ea5e9' },
        { key: 'air_temp', name: 'Air Temperature', color: '#ef4444' },
        { key: 'light', name: 'Light', color: '#eab308' },
    ];

    return (
        <div className="bflex flex-col gap-4 w-full">
            {/* Date Range Picker */}
            <div className="w-full max-w-md mx-auto mb-4">
                <DateRangePicker
                    from={dateRange.from}
                    to={dateRange.to}
                    onUpdate={({ from, to }) => setDateRange({ from: from ?? minDate, to: to ?? maxDate })}
                    min={minDate}
                    max={maxDate}
                />
            </div>
            {/* Графіки */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                {chartConfigs.map(config => (
                    <PlantChart
                        key={config.key}
                        data={data}
                        dataKey={config.key}
                        label={config.name}
                        color={config.color}
                    />
                ))}
            </div>
        </div>
    );
}
