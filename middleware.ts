import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Check if the current page is an authentication page
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  if (!token) {
    // If not logged in and trying to access any other page, redirect to /login
    if (!isAuthPage) {
      const loginUrl = new URL('/login', request.url);
      // Keep track of the original page to redirect back if needed
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  } else {
    // If logged in and trying to access /login or /register, redirect to Dashboard (/)
    if (pathname === '/login' || pathname === '/register') {
      const dashboardUrl = new URL('/', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. api (API routes)
     * 2. _next/static (static files)
     * 3. _next/image (image optimization files)
     * 4. favicon.ico, sitemap.xml, robots.txt (metadata files)
     * 5. Static files with extensions (e.g. .svg, .png, .jpg, etc. via checking for a dot)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
};
