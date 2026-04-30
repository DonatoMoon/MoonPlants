// components/auth/AuthCta.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useAuthUI } from '@/lib/state/auth-ui';
import { useRouter } from "next/navigation";
import { ArrowBigRight } from "lucide-react";
import { useTranslations } from 'next-intl';

export default function AuthCta({ user }: { user: { id: string } | null }) {
    const open = useAuthUI(s => s.open);
    const router = useRouter();
    const t = useTranslations('HeroSection');

    if (user) {
        return (
            <Button
                variant="outline"
                className="py-6 px-5 border-white text-white hover:bg-white/10"
                onClick={() => router.push("/profile")}
            >
                <span className="pr-4">{t('goToProfile')}</span>
                <ArrowBigRight className="w-5 h-5" />
            </Button>
        );
    }
    return (
        <Button
            variant="outline"
            className="py-6 px-5 border-white text-white hover:bg-white/10"
            onClick={() => open('signup')}
        >
            <span className="pr-4">{t('getStarted')}</span>
            <ArrowBigRight className="w-5 h-5" />
        </Button>
    );
    }