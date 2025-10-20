// components/profile/PlantChart.tsx
'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// 1) Явно перелічуємо ключі числових рядів
export type NumericSeriesKey = 'soil_moisture' | 'air_humidity' | 'air_temp' | 'light';

// 2) Точка даних: time — string, а числові ряди — number
export type DataPoint = { time: string } & Record<NumericSeriesKey, number>;

type PlantChartProps = {
    data: DataPoint[];
    dataKey: NumericSeriesKey;   // тепер не вільний string, а один із ключів вище
    label: string;
    color: string;
};

export default function PlantChart({ data, dataKey, label, color }: PlantChartProps) {
    return (
        <div className="w-full bg-white/10 rounded-xl p-4 shadow backdrop-blur">
            <h3 className="mb-2 text-white/80 font-semibold text-center">{label}</h3>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fff2" />
                    <XAxis dataKey="time" tick={{ fill: "#ddd" }} fontSize={12} />
                    <YAxis tick={{ fill: "#ddd" }} fontSize={12} />
                    <Tooltip
                        contentStyle={{ backgroundColor: "#222", border: "none", color: "#fff" }}
                        labelStyle={{ color: "#fff" }}
                        itemStyle={{ color: "#fff" }}
                    />
                    <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
