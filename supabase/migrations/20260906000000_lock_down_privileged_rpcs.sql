-- Lock down privileged worker/upload RPCs.
-- These functions are intentionally server-only because they run as SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.claim_ai_job()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  document_id uuid,
  operation text,
  idempotency_key text,
  status text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_job_id uuid;
BEGIN
  UPDATE public.ai_jobs
  SET
    status = 'processing',
    started_at = now()
  WHERE public.ai_jobs.id = (
    SELECT aj.id
    FROM public.ai_jobs aj
    WHERE aj.status = 'queued'
    ORDER BY aj.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING public.ai_jobs.id INTO claimed_job_id;

  RETURN QUERY
  SELECT *
  FROM public.ai_jobs
  WHERE public.ai_jobs.id = claimed_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_ai_job() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_ai_job() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_ai_job() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_job() TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_document_upload(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_document_upload(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_document_upload(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_document_upload(uuid, uuid, text) TO service_role;
