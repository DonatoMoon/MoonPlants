import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({ request });

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesArr) => {
                    for (const { name, value, options } of cookiesArr) {
                        response.cookies.set(name, value, options);
                    }
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isProtectedPage = pathname.startsWith('/profile');

    if (isProtectedPage && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        url.searchParams.set('auth', 'signin');
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ['/profile/:path*'],
};
