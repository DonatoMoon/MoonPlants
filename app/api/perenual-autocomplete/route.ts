// app/api/perenual-autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('q');
    if (!query) return NextResponse.json({ data: [] });

    const apiKey = process.env.PERENUAL_API_KEY!;
    // ОНОВЛЕНА URL!!!
    const url = `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    const data = await res.json();

    // DEBUG: подивись в логах що реально повертає API
    console.log("Perenual API RAW RESPONSE:", data);

    // Трансформуємо лише необхідні поля для автокомпліта
    const results = (data.data || []).map((item: any) => ({
        id: item.id,
        name: item.common_name
            ? `${item.common_name} (${item.scientific_name?.[0] ?? ''})`
            : (item.scientific_name?.[0] ?? "Unknown"),
        image: item.default_image?.small_url,
    }));

    return NextResponse.json({ data: results });
}
