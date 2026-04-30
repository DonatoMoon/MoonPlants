'use server';
import { cookies } from 'next/headers';

const locales = ['en', 'uk'] as const;
type Locale = (typeof locales)[number];

export async function setLocale(locale: Locale) {
    if (!locales.includes(locale)) return;
    const cookieStore = await cookies();
    cookieStore.set('NEXT_LOCALE', locale, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
    });
}
