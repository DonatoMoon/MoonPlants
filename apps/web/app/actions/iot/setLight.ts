'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/getUser';
import { IoTService } from '@/lib/services/iot.service';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { uuidSchema } from '@/lib/iot/schemas';

const schema = z.object({
    deviceId: uuidSchema,
    mode: z.enum(['on', 'on_for', 'off']),
    durationSec: z.number().int().min(1).max(86400).optional(),
});

export async function setLightAction(input: z.infer<typeof schema>) {
    const user = await getCurrentUser();
    if (!user) throw new AppError('unauthorized', 'Не авторизовано', 401);

    const rl = rateLimit(`light:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new AppError('rate_limited', 'Забагато запитів, спробуйте за хвилину', 429);

    const parsed = schema.parse(input);
    return IoTService.setLight(user.id, parsed.deviceId, parsed.mode, parsed.durationSec);
}
