"use client";

import {LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer} from "recharts";
import {ComposedChart, AreaChart, Area, BarChart, Bar} from "recharts";

type DataPoint = { date: string; value: number };

export default function SoilMoistureChart({data}: { data: DataPoint[] }) {
    return (
        <>
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data}>
                    <XAxis dataKey="date"/>
                    <YAxis/>
                    <Tooltip/>
                    <Bar dataKey="value" fill="#bbf7d0"/>
                    <Line type="monotone" dataKey="value" stroke="#34D399" strokeWidth={2.5} dot/>
                </ComposedChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <XAxis dataKey="date" stroke="#888888"/>
                    <YAxis stroke="#888888"/>
                    <Tooltip/>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#34D399"
                        strokeWidth={3}
                        dot={{r: 5, fill: "#34D399"}}
                        activeDot={{r: 7}}
                    />
                </LineChart>

            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                    <XAxis dataKey="date"/>
                    <YAxis/>
                    <Tooltip/>
                    <Area type="monotone" dataKey="value" stroke="#4ADE80" fill="#bbf7d0" strokeWidth={2.5}/>
                </AreaChart>
            </ResponsiveContainer>


            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <XAxis dataKey="date"/>
                    <YAxis/>
                    <Tooltip/>
                    <Bar dataKey="value" fill="#34D399"/>
                </BarChart>
            </ResponsiveContainer>

        </>
    );
}
