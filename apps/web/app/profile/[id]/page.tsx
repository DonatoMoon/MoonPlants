// app/profile/[id]/page.tsx
import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import slugify from 'slugify';
import { Calendar, Container as ContainerIcon, Droplet, ChevronRight, Trash2, ArrowLeft } from 'lucide-react';
import { createSupabaseServer } from '@/lib/supabase/server';
import { BackgroundScene } from '@/components/layout/BackgroundScene';
import Container from '@/components/layout/Container';
import { GlassCard } from '@/components/primitives/GlassCard';
import { Stat } from '@/components/primitives/Stat';
import { EmptyState } from '@/components/primitives/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
} from '@/components/ui/alert-dialog';
import ChartsSection from '@/components/profile/charts/ChartsSection';
import MLPredictionCard from '@/components/profile/MLPredictionCard';
import SpeciesInfoBlock, { type SpeciesCacheData } from '@/components/profile/SpeciesInfoBlock';
import { deletePlant } from '@/app/actions/plants/deletePlant';
import { getTranslations, getLocale } from 'next-intl/server';
import { MLPredictionSkeleton } from '@/components/profile/skeletons';

export default async function PlantPage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const t = await getTranslations('PlantDetail');
    const locale = await getLocale();

    const supabase = await createSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <BackgroundScene variant="profile">
                <Container className="flex-1 py-10">
                    <EmptyState title={t('loginRequired')} />
                </Container>
            </BackgroundScene>
        );
    }

    const { data: plant } = await supabase
        .from('plants')
        .select('*, species_cache:species_cache_id(perenual_id, common_name, scientific_name, family, type, watering, sunlight, indoor, cycle, default_image_url, raw_json)')
        .eq('id', id)
        .eq('owner_user_id', user.id)
        .maybeSingle();

    if (!plant) {
        return (
            <BackgroundScene variant="profile">
                <Container className="flex-1 py-10">
                    <EmptyState
                        title={t('notFound')}
                        description={t('notFoundDesc')}
                        action={
                            <Button asChild variant="outline">
                                <Link href="/profile">
                                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                                    {t('backToPlants')}
                                </Link>
                            </Button>
                        }
                    />
                </Container>
            </BackgroundScene>
        );
    }

    const perenualId = (plant.species_cache as { perenual_id?: number } | null)?.perenual_id;
    const speciesSlug =
        slugify((plant.species_name || plant.name || '').toString(), {
            lower: true,
            strict: true,
        }) + (perenualId ? '-' + perenualId : '');

    const lastWatered = plant.last_watered_at
        ? new Date(plant.last_watered_at).toLocaleDateString(locale)
        : '—';

    return (
        <BackgroundScene variant="profile">
            <Container className="flex-1 py-8 md:py-12">
                <nav aria-label={t('breadcrumb')} className="mb-6 text-sm text-[var(--fg-muted)]">
                    <ol className="flex items-center gap-1.5 flex-wrap">
                        <li>
                            <Link href="/" className="hover:text-[var(--fg)]">
                                {t('breadcrumbHome')}
                            </Link>
                        </li>
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        <li>
                            <Link href="/profile" className="hover:text-[var(--fg)]">
                                {t('breadcrumbPlants')}
                            </Link>
                        </li>
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        <li
                            className="text-[var(--fg)] font-medium truncate max-w-[200px]"
                            aria-current="page"
                        >
                            {plant.name || plant.species_name}
                        </li>
                    </ol>
                </nav>

                <GlassCard className="p-6 md:p-8 mb-8">
                    <div className="flex flex-col sm:flex-row gap-6 md:gap-8 items-center sm:items-start">
                        {plant.image_url && (
                            <div className="flex-shrink-0">
                                <Image
                                    src={plant.image_url}
                                    alt={plant.name || plant.species_name || 'Рослина'}
                                    width={180}
                                    height={180}
                                    sizes="(max-width: 640px) 160px, 180px"
                                    className="rounded-[var(--radius-md)] object-cover"
                                    draggable={false}
                                    priority
                                />
                            </div>
                        )}
                        <div className="flex flex-col items-center sm:items-start text-center sm:text-left flex-1 min-w-0">
                            <h1 className="font-display text-3xl md:text-4xl font-semibold text-[var(--fg)] mb-1 tracking-tight">
                                {plant.name || plant.species_name}
                            </h1>
                            {plant.name && plant.species_name && (
                                <p className="text-base italic text-[var(--fg-muted)] mb-4">
                                    {plant.species_name}
                                </p>
                            )}
                            {speciesSlug && (
                                <Button asChild variant="outline" size="sm" className="bg-[var(--glass-bg)] border-[var(--glass-border)] hover:bg-[var(--glass-bg-strong)]">
                                    <Link href={`/plant-species/${speciesSlug}`}>
                                        {t('speciesInfo')}
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </GlassCard>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
                    <Stat
                        icon={Calendar}
                        label={t('ageStat')}
                        value={plant.age_months ?? '—'}
                        unit={t('ageUnit')}
                    />
                    <Stat
                        icon={ContainerIcon}
                        label={t('potStat')}
                        value={
                            plant.pot_height_cm || plant.pot_diameter_cm
                                ? `${plant.pot_height_cm ?? '—'}×${plant.pot_diameter_cm ?? '—'}`
                                : '—'
                        }
                        unit={t('potUnit')}
                    />
                    <Stat
                        icon={Droplet}
                        label={t('lastWateredStat')}
                        value={lastWatered}
                    />
                </div>

                <Suspense fallback={<MLPredictionSkeleton />}>
                    <PredictionLoader plantId={id} />
                </Suspense>

                {perenualId && plant.species_cache && (
                    <Suspense
                        fallback={
                            <Skeleton className="w-full h-48 rounded-[var(--radius-lg)] bg-[var(--glass-bg-strong)] mt-8" />
                        }
                    >
                        <SpeciesInfoBlock
                            species={plant.species_cache as SpeciesCacheData}
                            speciesSlug={speciesSlug}
                        />
                    </Suspense>
                )}

                <section aria-label={t('chartsLabel')} className="w-full mt-8 mb-10">
                    <Suspense
                        fallback={
                            <Skeleton className="w-full h-72 rounded-[var(--radius-lg)] bg-[var(--glass-bg-strong)]" />
                        }
                    >
                        <MeasurementsLoader plantId={id} />
                    </Suspense>
                </section>

                <div className="flex justify-center w-full pt-4 border-t border-[var(--glass-border)]">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="lg">
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t('deleteButton')}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('deleteDesc')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('deleteCancel')}</AlertDialogCancel>
                                <form
                                    action={async () => {
                                        'use server';
                                        await deletePlant(id);
                                    }}
                                >
                                    <AlertDialogAction type="submit">{t('deleteConfirm')}</AlertDialogAction>
                                </form>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </Container>
        </BackgroundScene>
    );
}

async function PredictionLoader({ plantId }: { plantId: string }) {
    const supabase = await createSupabaseServer();
    const { data: prediction } = await supabase
        .from('predictions')
        .select('*')
        .eq('plant_id', plantId)
        .order('predicted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return <MLPredictionCard plantId={plantId} initialPrediction={prediction} />;
}

async function MeasurementsLoader({ plantId }: { plantId: string }) {
    const t = await getTranslations('PlantDetail');
    const supabase = await createSupabaseServer();
    const { data: measurements } = await supabase
        .from('measurements')
        .select('*')
        .eq('plant_id', plantId)
        .order('measured_at', { ascending: false })
        .limit(20);

    const sorted = (measurements ?? []).sort(
        (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
    );

    if (sorted.length === 0) {
        return (
            <GlassCard className="p-2">
                <EmptyState
                    title={t('noMeasurements')}
                    description={t('noMeasurementsDesc')}
                />
            </GlassCard>
        );
    }

    return <ChartsSection measurements={sorted} />;
}
