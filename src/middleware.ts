import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedAdmin } from '@/lib/admin-access';

const ADMIN_PATH = /^\/(admin|api\/admin)(\/|$)/;

function redirectToLogin(request: NextRequest, authResponse: NextResponse) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(loginUrl);
  authResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function middleware(request: NextRequest) {
  // The app has a guest experience: only account and admin pages are gated.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminRoute = ADMIN_PATH.test(request.nextUrl.pathname);
  const adminApi = request.nextUrl.pathname.startsWith('/api/admin');

  // Fail closed if deployment is misconfigured.
  if (!url || !key) {
    return new NextResponse('Autenticação temporariamente indisponível.', {
      status: 503,
    });
  }

  let authResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers?: Record<string, string>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        authResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          authResponse.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([name, value]) =>
            authResponse.headers.set(name, value)
          );
        }
      },
    },
  });

  // getUser() validates the token with Supabase Auth. Do not trust getSession()
  // or raw cookies for authorization.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    if (adminApi) {
      const response = NextResponse.json(
        { error: 'Autenticação necessária.' },
        { status: 401 }
      );
      authResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }
    return redirectToLogin(request, authResponse);
  }

  if (adminRoute && !isTrustedAdmin(user)) {
    if (adminApi) {
      const response = NextResponse.json(
        { error: 'Permissão de administrador necessária.' },
        { status: 403 }
      );
      authResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }
    return new NextResponse('Acesso restrito: conta sem permissão administrativa.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return authResponse;
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/settings/:path*',
    '/premium/:path*',
    '/ai-insights/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
