import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from '@/lib/supabase-config'

export async function createClient() {
  const cookieStore = await cookies()
  const config = getSupabasePublicConfig()

  return createServerClient(
    config.isConfigured ? config.url : "https://dummy.supabase.co",
    config.isConfigured ? config.key : "dummy_key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
