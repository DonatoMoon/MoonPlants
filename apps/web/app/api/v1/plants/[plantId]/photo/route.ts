// app/api/v1/plants/[plantId]/photo/route.ts
// POST /api/v1/plants/[plantId]/photo — завантажити нове фото рослини

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getUser";
import { PlantsService } from "@/lib/services/plants.service";

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ plantId: string }> }
) {
    try {
        const { plantId } = await props.params;
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image" }, { status: 400 });
        }

        const result = await PlantsService.updatePlantPhoto(user.id, plantId, file);

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("[POST /api/v1/plants/:id/photo]", err);
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.includes("not found") ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}
