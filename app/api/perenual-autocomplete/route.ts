// app/api/perenual-autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
    if (!query) return NextResponse.json({ data: [] });

    const apiKey = process.env.PERENUAL_API_KEY!;
    const url = `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    const data: PerenualResponse = await res.json();

    // DEBUG
    console.log('Perenual API RAW RESPONSE:', data);

    const results = (data.data ?? []).map((item) => ({
        id: item.id,
        name: item.common_name
            ? `${item.common_name} (${item.scientific_name?.[0] ?? ''})`
            : item.scientific_name?.[0] ?? 'Unknown',
        image: item.default_image?.small_url,
    }));

    return NextResponse.json({ data: results });
}
