import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // Protect all /admin paths, except /admin/login and /admin/login/api (if any)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !pathname.startsWith('/admin/login/api')) {
    const adminSecretCookie = request.cookies.get('admin_secret')?.value;
    const expectedSecret = process.env.ADMIN_SECRET || 'fallback_admin_secret_key';

    if (!adminSecretCookie || adminSecretCookie !== expectedSecret) {
      // Redirect to the login page and pass the current path as redirect query param
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
