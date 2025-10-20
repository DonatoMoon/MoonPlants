// app/profile/[id]/page.tsx

import { createSupabaseServer } from '@/lib/supabase/server';
import BackgroundImageContainer from '@/components/layout/BackgroundImageContainer';
import Container from '@/components/layout/Container';
import backImg from "@/public/profileBackground.png";
import Image from 'next/image';
import ChartsSection from '@/components/profile/ChartsSection';
import { deletePlant } from '@/app/actions/plants/deletePlant';
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import slugify from "slugify";
import Link from "next/link";

export default async function PlantPage(props: { params: Promise<{ id: string }> }) {

    const { id } = await props.params;   // <--- await саме params!


    const supabase = await createSupabaseServer();

    // Витягуємо рослину
    const { data: plant } = await supabase
        .from('plants')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (!plant) {
        return <div className="text-center py-10">Plant not found.</div>
    }

    // Витягуємо останні 20 вимірів для цієї рослини (для графіка)
    const { data: measurements } = await supabase
        .from('measurements')
        .select('*')
        .eq('plant_id', plant.id)
        .order('measured_at', { ascending: false })
        .limit(20);

    const sortedMeasurements = measurements ? [...measurements].sort(
        (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
    ) : [];
    const speciesSlug = slugify((plant.species_name || plant.name || "").toString(), { lower: true, strict: true }) + "-" + plant.species_id;

    // Далі структура:
    return (
        <BackgroundImageContainer src={backImg}>
            <Container className="py-10 flex flex-col items-center">

                {/* TOP: Зображення + Назви + кнопка Details */}
                <div className="flex flex-col sm:flex-row gap-8 items-center justify-center w-full max-w-2xl mb-8">
                    {/* LEFT: Зображення */}
                    <div className="flex-shrink-0">
                        {plant.image_url && (
                            <Image
                                src={plant.image_url}
                                alt={plant.name || plant.species_name}
                                width={160}
                                height={160}
                                className="rounded-xl object-cover"
                                draggable={false}
                                priority
                            />
                        )}
                    </div>
                    {/* RIGHT: Назви + кнопка */}
                    <div className="flex flex-col items-start w-full">
                        {plant.name
                            ? (
                                <>
                                    <h1 className="text-3xl font-bold text-white mb-1">
                                        {plant.name}
                                    </h1>
                                    <div className="text-lg italic text-white/80 mb-4">
                                        {plant.species_name}
                                    </div>
                                </>
                            )
                            : (
                                <h1 className="text-3xl font-bold text-white mb-4">
                                    {plant.species_name}
                                </h1>
                            )
                        }
                        <Button
                            asChild
                            variant="outline"
                            className="border-white text-white hover:bg-white/10 hover:shadow-lg mb-2"
                        >
                            <Link href={`/plant-species/${speciesSlug}`}>
                                View Details
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Блоки віку, горщика, поливу */}
                <div className="flex flex-wrap gap-6 mb-8 justify-center">
                    <div className="bg-white/10 rounded-xl px-6 py-4 flex flex-col items-center">
                        <div className="font-semibold text-white">Вік</div>
                        <div className="text-lg font-bold">{plant.age_months ?? '--'} <span
                            className="text-base">міс</span></div>
                    </div>
                    <div className="bg-white/10 rounded-xl px-6 py-4 flex flex-col items-center">
                        <div className="font-semibold text-white">Горщик</div>
                        <div className="text-lg font-bold">
                            {plant.pot_height_cm ?? '--'}x{plant.pot_diameter_cm ?? '--'} <span
                            className="text-base">см</span>
                        </div>
                    </div>
                    <div className="bg-white/10 rounded-xl px-6 py-4 flex flex-col items-center">
                        <div className="font-semibold text-white">Останній полив</div>
                        <div className="text-lg font-bold">
                            {plant.last_watered_at ? new Date(plant.last_watered_at).toLocaleDateString() : '--'}
                        </div>
                    </div>
                </div>

                {/* Графіки або текст якщо даних немає */}
                <div className="w-full my-8">
                    {sortedMeasurements.length === 0 ? (
                        <div className="bg-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-white/80 text-xl shadow-xl backdrop-blur-md min-h-[180px]">
                            No measurements yet. Your plant’s data will appear here soon!
                        </div>
                    ) : (
                        <ChartsSection measurements={sortedMeasurements} />
                    )}
                </div>

                {/* DELETE BUTTON внизу */}
                <div className="mt-8 flex justify-center w-full">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="lg">
                                Delete Plant
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Are you sure you want to delete this plant?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. All measurements and data will be permanently deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <form action={async () => {
                                    "use server";
                                    await deletePlant(id);
                                }}>
                                    <AlertDialogAction type="submit">
                                        Delete
                                    </AlertDialogAction>
                                </form>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

            </Container>
        </BackgroundImageContainer>
    );
}
