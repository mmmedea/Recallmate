import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicConfig } from '@/lib/supabase-config'

export function createClient() {
  const config = getSupabasePublicConfig()
  return createBrowserClient(
    config.isConfigured ? config.url : "https://dummy.supabase.co",
    config.isConfigured ? config.key : "dummy_key"
  )
}
