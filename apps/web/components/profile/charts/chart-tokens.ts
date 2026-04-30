// chart-tokens.ts — CSS-var-driven recharts palette.
// Use via chartTheme() (client-only) so charts follow light/dark tokens automatically.

export const chartSeriesKeys = ['soil_moisture', 'air_humidity', 'air_temp', 'light'] as const;
export type ChartSeriesKey = (typeof chartSeriesKeys)[number];

type SeriesMeta = {
    name: string;
    cssVar: string;
    unit: string;
    tailwindColor: string; // for text coloring
    hex: string;          // for rechart lines
};

export const chartSeries: Record<ChartSeriesKey, SeriesMeta> = {
    soil_moisture: {
        name: 'Вологість ґрунту',
        cssVar: '--color-chart-1',
        unit: '%',
        tailwindColor: 'text-green-400',
        hex: '#4ade80',
    },
    air_humidity: {
        name: 'Вологість повітря',
        cssVar: '--color-chart-2',
        unit: '%',
        tailwindColor: 'text-blue-400',
        hex: '#60a5fa',
    },
    air_temp: {
        name: 'Температура повітря',
        cssVar: '--color-chart-3',
        unit: '°C',
        tailwindColor: 'text-red-400',
        hex: '#f87171',
    },
    light: {
        name: 'Освітленість',
        cssVar: '--color-chart-4',
        unit: 'lx',
        tailwindColor: 'text-yellow-300',
        hex: '#fde047',
    },
};

/**
 * Read CSS variables at call time (client-only).
 * Falls back to safe defaults during SSR or if var is missing.
 */
export function chartTheme() {
    if (typeof window === 'undefined') {
        return {
            fg: '#e5e5e5',
            fgMuted: '#a3a3a3',
            border: 'rgba(255,255,255,0.1)',
            popover: '#1c1c1c',
        };
    }
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    return {
        fg: get('--fg', '#e5e5e5'),
        fgMuted: get('--fg-muted', '#a3a3a3'),
        border: get('--glass-border', 'rgba(255,255,255,0.1)'),
        popover: get('--bg-elev-1', '#1c1c1c'),
    };
}

export function seriesColor(key: ChartSeriesKey): string {
    return chartSeries[key].hex;
}
