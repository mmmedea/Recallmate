-- Private answer keys for generated identification questions.
-- Browser roles have no table privileges; only server-side service-role code
-- can retrieve answer material after an authenticated answer submission.
CREATE TABLE IF NOT EXISTS public.quiz_identification_answer_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  accepted_answers text[] NOT NULL DEFAULT ARRAY[]::text[],
  explanation text NOT NULL,
  source_evidence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT quiz_identification_answer_keys_answer_nonempty CHECK (length(btrim(answer_text)) > 0),
  CONSTRAINT quiz_identification_answer_keys_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS quiz_identification_answer_keys_owner_expiry_idx
ON public.quiz_identification_answer_keys (user_id, expires_at);

ALTER TABLE public.quiz_identification_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_identification_answer_keys FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.quiz_identification_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quiz_identification_answer_keys TO service_role;
