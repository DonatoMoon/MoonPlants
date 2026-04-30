// lib/supabase/admin.ts
// Supabase client з service_role key — ТІЛЬКИ для серверного коду!
// Ніколи не імпортувати в клієнтські компоненти.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";
import { env } from "@/lib/env";

let adminClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdmin(): SupabaseClient<Database> {
    if (adminClient) return adminClient;

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
    }

    adminClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return adminClient;
}


