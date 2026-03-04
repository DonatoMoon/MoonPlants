// lib/supabase/admin.ts
// Supabase client з service_role key — ТІЛЬКИ для серверного коду!
// Ніколи не імпортувати в клієнтські компоненти.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

let adminClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdmin(): SupabaseClient<Database> {
    if (adminClient) return adminClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
        );
    }

    adminClient = createClient<Database>(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return adminClient;
}


