import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis and RateLimiter only if credentials exist to avoid crashing
let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // Create a new ratelimiter, that allows 10 requests per 10 seconds per IP
  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // We only want to rate limit the expensive AI API routes
  if (pathname.startsWith('/api/chat') || pathname.startsWith('/api/extract-text') || pathname.startsWith('/api/generate-content')) {
    
    // Check if user is premium via secure HttpOnly cookie
    const isPremium = request.cookies.has('recallmate_premium');

    if (isPremium) {
      // Premium users bypass the rate limiter completely
      return NextResponse.next();
    }

    if (ratelimit) {
      const ip = request.ip ?? '127.0.0.1';
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment.' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            }
          }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to API routes
    '/api/chat/:path*',
    '/api/extract-text/:path*',
    '/api/generate-content/:path*',
  ],
};
