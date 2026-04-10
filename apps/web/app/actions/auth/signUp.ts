// app/actions/auth/signUp.ts
'use server';

import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signUp(formData: FormData) {
    const supabase = await createSupabaseServer();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    redirect("/profile");
}
