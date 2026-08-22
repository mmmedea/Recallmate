import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from './utils/supabase/middleware';
// Upstash Redis is not Edge Runtime compatible in Next.js 14 middleware due to missing 'edge' export.
// We removed base rate limiting from the Edge middleware to fix Vercel deployment.
// Rate limiting is instead handled at the Server Action / Route Handler level (which run in Node.js runtime).

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase Auth Session
  const supabaseResponse = await updateSession(request);

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
