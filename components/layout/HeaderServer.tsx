// components/layout/HeaderServer.tsx
// ----------------------------------
import { createSupabaseServer } from "@/lib/supabase/server";
import Header from "./Header"; // Твій клієнтський хедер

export default async function HeaderServer() {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    return <Header user={user} />;
}
