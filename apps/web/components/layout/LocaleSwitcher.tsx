'use client';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/app/actions/setLocale';

export function LocaleSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSwitch = (next: 'en' | 'uk') => {
        if (next === locale) return;
        startTransition(async () => {
            await setLocale(next);
            router.refresh();
        });
    };

    return (
        <div
            className="flex items-center gap-1 text-sm font-medium select-none"
            aria-label="Language switcher"
        >
            <button
                onClick={() => handleSwitch('en')}
                disabled={isPending}
                className={`px-1 transition-opacity ${locale === 'en' ? 'opacity-100 underline underline-offset-2' : 'opacity-50 hover:opacity-80'}`}
                aria-pressed={locale === 'en'}
                aria-label="Switch to English"
            >
                EN
            </button>
            <span className="opacity-30 text-xs">|</span>
            <button
                onClick={() => handleSwitch('uk')}
                disabled={isPending}
                className={`px-1 transition-opacity ${locale === 'uk' ? 'opacity-100 underline underline-offset-2' : 'opacity-50 hover:opacity-80'}`}
                aria-pressed={locale === 'uk'}
                aria-label="Перемкнути на українську"
            >
                UA
            </button>
        </div>
    );
}
