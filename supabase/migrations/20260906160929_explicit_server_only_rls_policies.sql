-- Explicitly deny direct client access to server-owned audit/support tables.
-- Server routes keep access through service_role.

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny client access to AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Deny client access to AI usage logs" ON public.ai_usage_logs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client access to support submissions" ON public.support_submissions;
CREATE POLICY "Deny client access to support submissions" ON public.support_submissions
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.ai_usage_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_submissions FROM anon, authenticated;

GRANT ALL ON TABLE public.ai_usage_logs TO service_role;
GRANT ALL ON TABLE public.support_submissions TO service_role;

NOTIFY pgrst, 'reload schema';
