import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
    Droplet,
    Sun,
    Repeat2,
    TrendingUp,
    Leaf,
    Users,
    Home,
    Wrench,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ExternalLink,
} from 'lucide-react';
import { GlassCard } from '@/components/primitives/GlassCard';
import { Button } from '@/components/ui/button';

type RawJson = {
    care_level?: string | null;
    growth_rate?: string | null;
    maintenance?: string | null;
    propagation?: string[];
    drought_tolerant?: boolean | null;
    edible_fruit?: boolean | null;
    poisonous_to_humans?: boolean | number | null;
    poisonous_to_pets?: boolean | number | null;
    description?: string | null;
    genus?: string | null;
    soil?: string[];
    [key: string]: unknown;
};

export type SpeciesCacheData = {
    perenual_id: number;
    common_name: string | null;
    scientific_name: unknown;
    family: string | null;
    type: string | null;
    watering: string | null;
    sunlight: unknown;
    indoor: boolean | null;
    cycle: string | null;
    default_image_url: string | null;
    raw_json: unknown;
};

interface SpeciesInfoBlockProps {
    species: SpeciesCacheData;
    speciesSlug: string;
}

function parseBool(v: boolean | number | null | undefined): boolean | null {
    if (v == null) return null;
    return Boolean(v);
}

function MetricBadge({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <Icon className="h-4 w-4 mt-0.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--fg-subtle)] leading-none mb-1">
                    {label}
                </p>
                <p className="text-sm font-semibold text-[var(--fg)] leading-snug capitalize truncate">
                    {value}
                </p>
            </div>
        </div>
    );
}

function BoolBadge({ label, value, danger = false }: { label: string; value: boolean; danger?: boolean }) {
    const Icon = value ? (danger ? AlertTriangle : CheckCircle2) : XCircle;
    const color = value
        ? danger
            ? 'text-[var(--destructive)] bg-[var(--destructive)]/10 border-[var(--destructive)]/20'
            : 'text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20'
        : 'text-[var(--fg-subtle)] bg-[var(--glass-bg)] border-[var(--glass-border)]';

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-pill)] border text-xs font-medium ${color}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
        </div>
    );
}

export default async function SpeciesInfoBlock({ species, speciesSlug }: SpeciesInfoBlockProps) {
    const t = await getTranslations('SpeciesInfo');

    const raw = (species.raw_json ?? {}) as RawJson;
    const scientificNames = Array.isArray(species.scientific_name)
        ? (species.scientific_name as string[])
        : [];
    const sunlightArr = Array.isArray(species.sunlight)
        ? (species.sunlight as string[])
        : [];

    const metrics: { icon: React.ElementType; label: string; value: string | null | undefined }[] = [
        { icon: Droplet, label: t('watering'), value: species.watering },
        { icon: Sun, label: t('sunlight'), value: sunlightArr.join(', ') || null },
        { icon: Repeat2, label: t('cycle'), value: species.cycle },
        { icon: Leaf, label: t('careLevel'), value: raw.care_level },
        { icon: TrendingUp, label: t('growthRate'), value: raw.growth_rate },
        { icon: Users, label: t('family'), value: species.family },
        { icon: Home, label: t('type'), value: species.type },
        { icon: Wrench, label: t('maintenance'), value: raw.maintenance },
    ].filter((m) => m.value);

    const booleansRaw: { label: string; value: boolean | null; danger?: boolean }[] = [
        { label: t('indoor'), value: species.indoor },
        { label: t('droughtTolerant'), value: parseBool(raw.drought_tolerant) },
        { label: t('edibleFruit'), value: parseBool(raw.edible_fruit) },
        { label: t('poisonousHumans'), value: parseBool(raw.poisonous_to_humans), danger: true },
        { label: t('poisonousPets'), value: parseBool(raw.poisonous_to_pets), danger: true },
    ];
    const booleans = booleansRaw.filter(
        (b): b is { label: string; value: boolean; danger?: boolean } => b.value !== null,
    );

    return (
        <GlassCard className="p-6 md:p-8 mt-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-5 items-start mb-6">
                {species.default_image_url && (
                    <div className="shrink-0">
                        <Image
                            src={species.default_image_url}
                            alt={species.common_name ?? 'Species'}
                            width={96}
                            height={96}
                            sizes="96px"
                            className="rounded-[var(--radius-md)] object-cover ring-1 ring-[var(--glass-border)]"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">
                        {t('title')}
                    </p>
                    {species.common_name && (
                        <h2 className="font-display text-2xl md:text-3xl font-semibold text-[var(--fg)] leading-tight mb-1">
                            {species.common_name}
                        </h2>
                    )}
                    {scientificNames.length > 0 && (
                        <p className="text-sm italic text-[var(--fg-muted)]">
                            {scientificNames[0]}
                        </p>
                    )}
                </div>
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="shrink-0 bg-[var(--glass-bg)] border-[var(--glass-border)] hover:bg-[var(--glass-bg-strong)]"
                >
                    <Link href={`/plant-species/${speciesSlug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        {t('viewFull')}
                    </Link>
                </Button>
            </div>

            {/* Description */}
            {raw.description && (
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed mb-6 border-l-2 border-[var(--accent)] pl-4">
                    {raw.description}
                </p>
            )}

            {/* Care metrics grid */}
            {metrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-5">
                    {metrics.map((m) => (
                        <MetricBadge
                            key={m.label}
                            icon={m.icon}
                            label={m.label}
                            value={m.value as string}
                        />
                    ))}
                </div>
            )}

            {/* Boolean badges */}
            {booleans.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {booleans.map((b) => (
                        <BoolBadge key={b.label} label={b.label} value={b.value} danger={b.danger} />
                    ))}
                </div>
            )}
        </GlassCard>
    );
}
