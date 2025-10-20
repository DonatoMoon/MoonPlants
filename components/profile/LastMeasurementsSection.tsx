import LastMeasurementItem from "@/components/profile/LastMeasurementItem";
import { Thermometer, Droplets, Sun } from "lucide-react";

export default function LastMeasurementsSection({
                                                    measurement,
                                                }: {
    measurement: {
        air_temp?: number | null,
        air_humidity?: number | null,
        light?: number | null,
        measured_at?: string,
    } | null
}) {
    if (!measurement) {
        return (
            <div className="mb-8 text-center text-white/60">No measurements yet.</div>
        );
    }
    return (
        <section className="flex flex-col items-center my-10 w-full">
            <div className="flex w-full justify-center gap-3 sm:gap-6">
                <LastMeasurementItem
                    icon={<Thermometer className="w-8 h-8 text-red-400"/>}
                    label="Temperature"
                    value={measurement.air_temp}
                    unit="°C"
                />
                <LastMeasurementItem
                    icon={<Droplets className="w-8 h-8 text-blue-400"/>}
                    label="Humidity"
                    value={measurement.air_humidity}
                    unit="%"
                />
                <LastMeasurementItem
                    icon={<Sun className="w-8 h-8 text-yellow-400"/>}
                    label="Light"
                    value={measurement.light}
                    unit="lx"
                />
            </div>

            <div className="mt-2 text-xs text-white/60">
                {measurement.measured_at
                    ? `Last updated: ${new Date(measurement.measured_at).toLocaleString()}`
                    : 'No data'}
            </div>
        </section>
    );
}
