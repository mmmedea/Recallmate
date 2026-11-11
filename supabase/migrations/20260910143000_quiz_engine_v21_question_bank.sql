-- RecallMate Quiz Engine v2.1
-- Persistent question bank, semantic dedupe, unseen-first attempts, and frozen sessions.

CREATE TABLE IF NOT EXISTS public.quiz_source_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  source_block_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  concept_key text NOT NULL,
  concept_label text NOT NULL,
  relationship_key text NOT NULL DEFAULT 'fact',
  importance numeric NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, concept_key, relationship_key)
);

CREATE TABLE IF NOT EXISTS public.quiz_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  source_block_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL,
  concept_id uuid REFERENCES public.quiz_source_concepts(id) ON DELETE SET NULL,
  semantic_fingerprint text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  cognitive_skill text NOT NULL CHECK (cognitive_skill IN ('recall', 'comparison', 'application', 'scenario', 'analysis', 'integration')),
  question_type text NOT NULL DEFAULT 'multiple_choice',
  question_payload jsonb NOT NULL,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  generator_version text NOT NULL DEFAULT 'quiz_engine_v2_1',
  prompt_version text NOT NULL DEFAULT 'quiz_prompt_v2_1',
  qa_version text NOT NULL DEFAULT 'quiz_qa_v2_1',
  source_revision text,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'approved', 'rejected', 'retired')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_question_bank_document_fingerprint_active_idx
ON public.quiz_question_bank (document_id, semantic_fingerprint)
WHERE status IN ('candidate', 'approved');

CREATE INDEX IF NOT EXISTS quiz_question_bank_document_status_difficulty_idx
ON public.quiz_question_bank (document_id, status, difficulty, cognitive_skill);

CREATE INDEX IF NOT EXISTS quiz_question_bank_concept_status_idx
ON public.quiz_question_bank (concept_id, status)
WHERE concept_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  difficulty text NOT NULL DEFAULT 'mixed' CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  mode text NOT NULL DEFAULT 'unseen' CHECK (mode IN ('unseen', 'missed', 'hardest', 'deeper', 'mixed_review')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  question_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS quiz_sessions_user_document_created_idx
ON public.quiz_sessions (user_id, document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quiz_question_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_bank_id uuid REFERENCES public.quiz_question_bank(id) ON DELETE SET NULL,
  quiz_session_id uuid REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  correct boolean,
  served_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  response_time_ms integer CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
  UNIQUE(user_id, quiz_session_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_question_attempts_user_question_idx
ON public.quiz_question_attempts (user_id, question_id);

CREATE INDEX IF NOT EXISTS quiz_question_attempts_user_bank_idx
ON public.quiz_question_attempts (user_id, question_bank_id)
WHERE question_bank_id IS NOT NULL;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS semantic_fingerprint text,
  ADD COLUMN IF NOT EXISTS cognitive_skill text CHECK (cognitive_skill IS NULL OR cognitive_skill IN ('recall', 'comparison', 'application', 'scenario', 'analysis', 'integration')),
  ADD COLUMN IF NOT EXISTS question_bank_id uuid REFERENCES public.quiz_question_bank(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generator_version text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS qa_version text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved' CHECK (status IN ('approved', 'retired'));

CREATE INDEX IF NOT EXISTS questions_document_semantic_fingerprint_idx
ON public.questions (document_id, semantic_fingerprint)
WHERE semantic_fingerprint IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.learning_review_sessions') IS NOT NULL THEN
    ALTER TABLE public.learning_review_sessions
      ADD COLUMN IF NOT EXISTS quiz_session_id uuid REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS question_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
  END IF;
END;
$$;

ALTER TABLE public.quiz_source_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quiz source concepts" ON public.quiz_source_concepts;
CREATE POLICY "Users can view own quiz source concepts"
ON public.quiz_source_concepts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = quiz_source_concepts.document_id
      AND d.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view own quiz question bank" ON public.quiz_question_bank;
CREATE POLICY "Users can view own quiz question bank"
ON public.quiz_question_bank FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = quiz_question_bank.document_id
      AND d.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can view own quiz sessions"
ON public.quiz_sessions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own quiz question attempts" ON public.quiz_question_attempts;
CREATE POLICY "Users can view own quiz question attempts"
ON public.quiz_question_attempts FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Server-side persistence remains service-role only.
REVOKE ALL ON public.quiz_source_concepts FROM anon, authenticated;
REVOKE ALL ON public.quiz_question_bank FROM anon, authenticated;
REVOKE ALL ON public.quiz_sessions FROM anon, authenticated;
REVOKE ALL ON public.quiz_question_attempts FROM anon, authenticated;

GRANT SELECT ON public.quiz_source_concepts TO authenticated;
GRANT SELECT ON public.quiz_question_bank TO authenticated;
GRANT SELECT ON public.quiz_sessions TO authenticated;
GRANT SELECT ON public.quiz_question_attempts TO authenticated;
GRANT ALL ON public.quiz_source_concepts TO service_role;
GRANT ALL ON public.quiz_question_bank TO service_role;
GRANT ALL ON public.quiz_sessions TO service_role;
GRANT ALL ON public.quiz_question_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.set_quiz_question_bank_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_quiz_question_bank_updated_at_trigger ON public.quiz_question_bank;
CREATE TRIGGER set_quiz_question_bank_updated_at_trigger
BEFORE UPDATE ON public.quiz_question_bank
FOR EACH ROW EXECUTE PROCEDURE public.set_quiz_question_bank_updated_at();

REVOKE EXECUTE ON FUNCTION public.set_quiz_question_bank_updated_at() FROM public, anon, authenticated;
