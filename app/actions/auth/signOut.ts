// app/actions/auth/signOut.ts
// ----------------------------------
'use server';

import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    redirect("/");
}
