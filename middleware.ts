import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Bypassed: always proceed without redirecting to login
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
