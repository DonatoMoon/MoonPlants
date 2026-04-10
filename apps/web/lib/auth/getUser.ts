// lib/auth/getUser.ts
// Helper для отримання поточного користувача в API routes / server actions

import { createSupabaseServer } from "@/lib/supabase/server";

export async function getCurrentUser() {
    const supabase = await createSupabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

export async function requireUser() {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error("Unauthorized");
    }
    return user;
}

