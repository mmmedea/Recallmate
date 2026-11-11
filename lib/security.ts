import { createClient } from '@/utils/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { SupabaseClient } from '@supabase/supabase-js'

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

let ratelimit: Ratelimit | null = null;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (redisUrl && redisToken) {
  const redis = new Redis({ url: redisUrl, token: redisToken });

  ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
  });
}

export async function checkRateLimit(ip: string) {
  if (!ratelimit) {\n    if (process.env.NODE_ENV === 'production') {\n      throw new SecurityError('Rate limiting is not configured', 503)\n    }\n    return true\n  }
  
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    throw new SecurityError('Rate limit exceeded', 429)
  }
  return true;
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
