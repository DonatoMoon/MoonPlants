'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/getUser';
import { IoTService } from '@/lib/services/iot.service';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { uuidSchema } from '@/lib/iot/schemas';

const schema = z.object({
    plantId: uuidSchema,
    waterMl: z.number().int().min(1).max(5000),
});

export async function waterPlantAction(input: z.infer<typeof schema>) {
    const user = await getCurrentUser();
    if (!user) throw new AppError('unauthorized', 'Не авторизовано', 401);

    const rl = rateLimit(`water:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new AppError('rate_limited', 'Забагато запитів, спробуйте за хвилину', 429);

    const parsed = schema.parse(input);
    const result = await IoTService.waterPlant(user.id, parsed.plantId, parsed.waterMl);

    revalidatePath('/profile');
    revalidatePath(`/profile/${parsed.plantId}`);

    return result;
}
