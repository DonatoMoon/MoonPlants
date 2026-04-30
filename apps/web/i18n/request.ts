import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const locales = ['en', 'uk'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const raw = cookieStore.get('NEXT_LOCALE')?.value;
    const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : 'en';

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
