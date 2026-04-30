// /lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function createSupabaseServer() {
    const cookieStore = await cookies();

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cookiesArr) => {
                    try {
                        for (const cookie of cookiesArr) {
                            cookieStore.set(cookie);
                        }
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}
