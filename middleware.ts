import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from './utils/supabase/middleware';
// Upstash Redis is not Edge Runtime compatible in Next.js 14 middleware due to missing 'edge' export.
// We removed base rate limiting from the Edge middleware to fix Vercel deployment.
// Rate limiting is instead handled at the Server Action / Route Handler level (which run in Node.js runtime).

export async function middleware(request: NextRequest) {
  // Auth infrastructure outages must not take down public routes such as
  // /login and /signup. Protected app layouts still verify the user server-side.
  let supabaseResponse: NextResponse;
  try {
    supabaseResponse = await updateSession(request);
  } catch (error) {
    console.error("[middleware] Supabase session refresh failed", {
      path: request.nextUrl.pathname,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });

    // Never let a failed edge refresh become authorization. The server layout
    // performs its own verified session check before rendering app data.
    const pathname = request.nextUrl.pathname;
    const protectedRoutes = ["/dashboard", "/notes", "/quiz", "/upload", "/documents", "/flashcards", "/calendar", "/settings"];
    const isProtectedRoute = protectedRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      supabaseResponse = NextResponse.redirect(url);
    } else {
      supabaseResponse = NextResponse.next({ request });
    }
  }

  // 2. Rate Limiting for specific API routes
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/chat') || pathname.startsWith('/api/extract-text') || pathname.startsWith('/api/generate-content')) {
    // NOTE: Premium status checks are now handled strictly on the server via `requireEntitlement()`
    // Server Actions and API routes enforce stricter limits using Node.js runtime.
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
