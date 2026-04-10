import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type PerenualImage = {
    small_url?: string;
};

type PerenualItem = {
    id: number;
    common_name?: string | null;
    scientific_name?: string[] | null;
    default_image?: PerenualImage | null;
};

type PerenualResponse = {
    data?: PerenualItem[];
};

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('q');
    if (!query || query.length < 3) return NextResponse.json({ data: [] });

    const supabase = createSupabaseAdmin();

    // 1. Search local cache first to save Perenual API credits
    const { data: localResults } = await supabase
        .from("species_cache")
        .select("perenual_id, common_name, scientific_name, default_image_url")
        .ilike("common_name", `%${query}%`)
        .limit(10);

    if (localResults && localResults.length >= 5) {
        console.log(`[Autocomplete] Serving ${localResults.length} results from local cache for query: "${query}"`);
        const results = localResults.map(item => ({
            id: item.perenual_id,
            name: item.common_name 
                ? `${item.common_name} (${(item.scientific_name as string[])?.[0] ?? ''})` 
                : (item.scientific_name as string[])?.[0] ?? 'Unknown',
            image: item.default_image_url
        }));
        return NextResponse.json({ data: results });
    }

    // 2. If not enough local results, fetch from Perenual
    const apiKey = process.env.PERENUAL_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    try {
        const url = `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
        const data: PerenualResponse = await res.json();

        console.log(`[Autocomplete] Perenual API fetch for query: "${query}"`);

        const results = (data.data ?? []).map((item) => ({
            id: item.id,
            name: item.common_name
                ? `${item.common_name} (${item.scientific_name?.[0] ?? ''})`
                : item.scientific_name?.[0] ?? 'Unknown',
            image: item.default_image?.small_url,
        }));

        return NextResponse.json({ data: results });
    } catch (err) {
        console.error("[Autocomplete] Error fetching from Perenual:", err);
        return NextResponse.json({ data: [], error: "Failed to fetch from provider" }, { status: 502 });
    }
}
