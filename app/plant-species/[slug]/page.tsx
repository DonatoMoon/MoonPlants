// app/plant-species/[slug]/page.tsx

import { notFound } from "next/navigation";
import slugify from "slugify";

export const dynamic = "force-dynamic"; // якщо хочеш завжди свіжі дані

async function getSpeciesById(id: string, apiKey: string) {
    const url = `https://perenual.com/api/v2/species/details/${id}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

export default async function PlantSpeciesPage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = await props.params; // <- тут await саме params!

    // id — це все після останнього дефіса (наприклад, "aloe-vera-728")
    const id = slug.split("-").pop();
    if (!id || isNaN(Number(id))) return notFound();

    const apiKey = process.env.PERENUAL_API_KEY!;
    const species = await getSpeciesById(id, apiKey);

    if (!species || !species.id) return notFound();

    return (
        <main className="flex flex-col items-center py-12 px-4 max-w-2xl mx-auto">
            {/* Назва + картинка */}
            <h1 className="text-3xl font-bold mb-3 text-center">
                {species.common_name || species.scientific_name?.[0]}
            </h1>
            <div className="mb-6 text-center italic text-gray-500">
                {species.scientific_name?.join(", ")}
            </div>
            {species.default_image?.regular_url && (
                <img
                    src={species.default_image.regular_url}
                    alt={species.common_name}
                    className="rounded-xl object-cover mb-8 mx-auto max-h-72"
                    style={{ maxWidth: "100%" }}
                />
            )}

            {/* Опис */}
            {species.description && (
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 w-full text-white/90">
                    <div className="font-semibold mb-2">Description</div>
                    <div>{species.description}</div>
                </div>
            )}

            {/* Інфа про вид */}
            <div className="w-full flex flex-col gap-4">
                <DetailRow label="Family" value={species.family} />
                <DetailRow label="Genus" value={species.genus} />
                <DetailRow label="Cycle" value={species.cycle} />
                <DetailRow label="Growth Rate" value={species.growth_rate} />
                <DetailRow label="Type" value={species.type} />
                <DetailRow label="Care Level" value={species.care_level} />
                <DetailRow label="Propagation" value={species.propagation?.join(", ")} />
                <DetailRow label="Sunlight" value={species.sunlight?.join(", ")} />
                <DetailRow label="Watering" value={species.watering} />
                <DetailRow label="Soil" value={species.soil?.join(", ")} />
                <DetailRow label="Maintenance" value={species.maintenance} />
                <DetailRow label="Drought Tolerant" value={species.drought_tolerant ? "Yes" : "No"} />
                <DetailRow label="Edible Fruit" value={species.edible_fruit ? "Yes" : "No"} />
                <DetailRow label="Indoor" value={species.indoor ? "Yes" : "No"} />
                <DetailRow label="Poisonous to Humans" value={species.poisonous_to_humans ? "Yes" : "No"} />
                <DetailRow label="Poisonous to Pets" value={species.poisonous_to_pets ? "Yes" : "No"} />
                {/* Додай ще що хочеш */}
            </div>
        </main>
    );
}

// Компактний рядок для таблички деталей
function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
    if (value === undefined || value === null || value === "") return null;
    return (
        <div className="flex items-baseline gap-3">
            <span className="font-semibold text-white/70 min-w-[120px]">{label}:</span>
            <span className="text-white">{value}</span>
        </div>
    );
}
