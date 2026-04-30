import { Thermometer, Droplets, Sun } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Stat } from '@/components/primitives/Stat';
import { SectionHeading } from '@/components/primitives/SectionHeading';

type Measurement = {
    air_temp_c?: number | null;
    air_humidity_pct?: number | null;
    light_lux?: number | null;
    measured_at?: string;
} | null;

const formatVal = (v?: number | null, digits = 1) =>
    v == null || Number.isNaN(v) ? '—' : digits === 0 ? Math.round(v).toString() : v.toFixed(digits);

export default async function LastMeasurementsSection({ measurement }: { measurement: Measurement }) {
    const t = await getTranslations('LastMeasurements');
    const locale = await getLocale();

    return (
        <section className="w-full mt-6 mb-10" aria-labelledby="measurements-heading">
            <SectionHeading
                title={t('title')}
                kicker={t('kicker')}
                description={
                    measurement?.measured_at
                        ? t('updatedAt', { time: new Date(measurement.measured_at).toLocaleString(locale) })
                        : t('noData')
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Stat
                    icon={Thermometer}
                    label={t('temperature')}
                    value={formatVal(measurement?.air_temp_c, 1)}
                    unit="°C"
                    colorClassName="text-red-400/90"
                />
                <Stat
                    icon={Droplets}
                    label={t('humidity')}
                    value={formatVal(measurement?.air_humidity_pct, 0)}
                    unit="%"
                    colorClassName="text-blue-400/90"
                />
                <Stat
                    icon={Sun}
                    label={t('light')}
                    value={formatVal(measurement?.light_lux, 0)}
                    unit="lx"
                    colorClassName="text-yellow-300/90"
                />
            </div>
        </section>
    );
}
