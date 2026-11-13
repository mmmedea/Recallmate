import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-site tracking.
  // DO NOT USE supabase.auth.getSession() HERE!
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const protectedRoutes = [
    '/dashboard',
    '/notes',
    '/quiz',
    '/upload',
    '/documents',
    '/flashcards',
    '/calendar',
    '/settings',
  ]
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  const isAuthOrHomeRoute =
    pathname === '/' || pathname === '/login' || pathname === '/signup'

  const redirectWithRefreshedCookies = (url: URL) => {
    const response = NextResponse.redirect(url)
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie)
    }
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return redirectWithRefreshedCookies(url)
  }

  if (isAuthOrHomeRoute && user) {
    const username = user.user_metadata?.username
    const accountCompleted = user.user_metadata?.recallmate_account_completed === true
    const url = request.nextUrl.clone()
    url.pathname =
      typeof username === 'string' && username.trim().length >= 3 && accountCompleted
        ? '/dashboard'
        : '/onboarding'
    url.search = ''
    if (url.pathname === '/onboarding') {
      url.searchParams.set('next', '/dashboard')
    }
    return redirectWithRefreshedCookies(url)
  }

  supabaseResponse.headers.set('Cache-Control', 'private, no-store')
  return supabaseResponse
}
