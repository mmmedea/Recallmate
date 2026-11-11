-- Dashboard/material queries and failed job transitions share this optional
-- diagnostic column. Older production ai_jobs schemas lack it.
ALTER TABLE public.ai_jobs ADD COLUMN IF NOT EXISTS error_message text;

NOTIFY pgrst, 'reload schema';
