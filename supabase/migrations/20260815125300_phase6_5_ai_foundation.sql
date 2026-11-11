-- ========================================================================================
-- RECALLMATE — PHASE 6.5: MEDEA AI FOUNDATION
-- ========================================================================================
-- This migration script establishes the observability and job tracking schema for Medea.
-- It adds strict ledgering, job attempts, and generation lineage.
-- ========================================================================================

-- 1. Alter ai_jobs to support idempotency and retry semantics
ALTER TABLE public.ai_jobs
ADD COLUMN IF NOT EXISTS attempt_count integer not null default 1 check (attempt_count > 0),
ADD COLUMN IF NOT EXISTS generation_version integer not null default 1 check (generation_version > 0),
ADD COLUMN IF NOT EXISTS prompt_version text,
ADD COLUMN IF NOT EXISTS parent_job_id uuid references public.ai_jobs(id) on delete set null,
ADD COLUMN IF NOT EXISTS metadata jsonb,
ADD COLUMN IF NOT EXISTS error_code text check (
  error_code in (
    'VALIDATION_ERROR', 'PROVIDER_ERROR', 'RATE_LIMITED', 
    'QUOTA_EXCEEDED', 'CONTEXT_TOO_LARGE', 'INVALID_OUTPUT', 
    'CITATION_ERROR', 'DATABASE_ERROR', 'TIMEOUT', 'UNKNOWN'
  )
);

-- Drop old unique constraint and replace with generation_version based constraint
DROP INDEX IF EXISTS public.idx_ai_jobs_user_idempotency;

-- Instead of a hard DB constraint on idempotency_key alone (which would break on retries if we insert new rows for retries), 
-- the user's advice: "the invariant should effectively be: logical generation -> one successful output -> multiple retry attempts allowed"
-- If we represent attempts as NEW rows (which is often better for history), they will share the same (document_id, operation, generation_version).
-- But wait, if they share it, we can't have a unique constraint on (document_id, operation, generation_version).
-- A partial index enforcing only ONE 'completed' job per logical generation is the elegant solution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_single_success_per_generation 
ON public.ai_jobs (document_id, operation, generation_version) 
WHERE status = 'completed';

-- To enforce that we don't have multiple jobs queued or processing at the same time for the same generation:
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_single_active_per_generation 
ON public.ai_jobs (document_id, operation, generation_version) 
WHERE status IN ('queued', 'processing');

-- 2. Modify ai_usage_logs to an immutable ledger
ALTER TABLE public.ai_usage_logs
ADD COLUMN IF NOT EXISTS job_id uuid references public.ai_jobs(id) on delete set null,
ADD COLUMN IF NOT EXISTS input_tokens integer not null default 0,
ADD COLUMN IF NOT EXISTS output_tokens integer not null default 0,
ADD COLUMN IF NOT EXISTS thoughts_tokens integer not null default 0,
ADD COLUMN IF NOT EXISTS cached_tokens integer not null default 0,
ADD COLUMN IF NOT EXISTS credits_consumed integer not null default 0;

-- Prevent UPDATEs on ai_usage_logs to keep it append-only
CREATE OR REPLACE FUNCTION public.prevent_ai_usage_log_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Updates to ai_usage_logs are strictly forbidden. This table is an immutable ledger.';
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_ai_usage_log_updates ON public.ai_usage_logs;
CREATE TRIGGER tr_prevent_ai_usage_log_updates
BEFORE UPDATE ON public.ai_usage_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_ai_usage_log_updates();
