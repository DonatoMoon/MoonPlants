// components/auth/AuthCta.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useAuthUI } from '@/lib/state/auth-ui';
import { useRouter } from "next/navigation";
import { ArrowBigRight } from "lucide-react";

export default function AuthCta({ user }: { user: { id: string } | null }) {
    const open = useAuthUI(s => s.open);
    const router = useRouter();
    if (user) {
        // Якщо залогінений — кнопка кидає на /profile
        return (
            <Button variant="outline" className="py-6 px-5" onClick={() => router.push("/profile")}>
                <span className="pr-4">Go to Profile</span>
                <ArrowBigRight className="w-5 h-5" />
            </Button>
        )
    }
    return (
        <Button variant="outline" className="py-6 px-5" onClick={() => open('signup')}>
            <span className="pr-4">Get Started Now</span>
            <ArrowBigRight className="w-5 h-5" />
        </Button>
    );
}