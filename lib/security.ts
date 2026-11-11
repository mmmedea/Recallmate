import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export class SecurityError extends Error {
  constructor(message: string, public status: number = 403) {
    super(message)
    this.name = 'SecurityError'
  }
}

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new SecurityError('Unauthorized', 401)
  }

  return { supabase, user }
}

export async function requireDocumentOwner(documentId: string) {
  const { supabase, user } = await requireUser()

  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    throw new SecurityError('Document not found or access denied', 403)
  }

  return { supabase, user }
}

export async function requireQuizAttemptOwner(attemptId: string) {
  const { supabase, user } = await requireUser()

  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id')
    .eq('id', attemptId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    throw new SecurityError('Quiz attempt not found or access denied', 403)
  }

  return { supabase, user }
}

export async function requireEntitlement() {
  const { supabase, user } = await requireUser()

  const { data, error } = await supabase
    .from('user_entitlements')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  const isPremium = data?.tier === 'premium' || data?.tier === 'pro'

  return { supabase, user, isPremium }
}

let rateLimitClient: SupabaseClient<Database> | null = null

function getRateLimitClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new SecurityError('Rate limiting is not configured', 503)
  }
  if (!rateLimitClient) {
    rateLimitClient = createAdminClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return rateLimitClient
}

export async function checkRateLimit(
  key: string,
  options: { limit?: number; windowSeconds?: number } = {}
) {
  if (typeof key !== 'string' || key.length < 1 || key.length > 512) {
    throw new SecurityError('Invalid rate-limit key', 400)
  }

  const limit = options.limit ?? 10
  const windowSeconds = options.windowSeconds ?? 10
  const admin = getRateLimitClient()
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error || typeof data !== 'boolean') {
    console.error('[security] database rate limiter unavailable:', error?.message)
    throw new SecurityError('Rate limiting is temporarily unavailable', 503)
  }
  if (!data) {
    throw new SecurityError('Rate limit exceeded', 429)
  }
  return true
}

export async function getOrCreateIdempotentJob(supabase: SupabaseClient, userId: string, idempotencyKey: string, documentId: string, operation: string) {
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (data) {
    return data
  }

  const { data: newJob, error: insertError } = await supabase
    .from('ai_jobs')
    .insert({
      user_id: userId,
      document_id: documentId,
      idempotency_key: idempotencyKey,
      operation: operation,
      status: 'queued'
    })
    .select()
    .single()

  if (insertError) {
    throw new SecurityError(`Failed to create idempotent job: ${insertError.message}`, 500)
  }

  return newJob
}
