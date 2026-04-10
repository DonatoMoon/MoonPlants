import React from "react";

type LastMeasurementsItemProps = {
    icon: React.ReactNode;
    label: string;
    value: number | string | null | undefined;
    unit?: string;           // °C, %, lx і т.д.
    className?: string;
};

export default function LastMeasurementItem({
                                                 icon,
                                                 label,
                                                 value,
                                                 unit,
                                                 className
                                             }: LastMeasurementsItemProps) {
    return (
        <div className={`
            flex flex-col items-center 
            bg-white/10 rounded-2xl py-6 shadow
            w-full max-w-xs
            ${className ?? ""}
        `}>
            {icon}
            <div className="mt-2 text-lg font-semibold text-white">{label}</div>
            <div className="text-2xl font-bold text-white mt-1">
                {value !== null && value !== undefined ? value : '--'}
                {unit && <span className="ml-1 text-base">{unit}</span>}
            </div>
        </div>
    );
}
