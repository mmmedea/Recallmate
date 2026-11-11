-- RecallMate Quiz Engine v2.1 prerequisite
-- Hardened FSRS learning tables/functions required by the current quiz routes.

CREATE TABLE IF NOT EXISTS public.learning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  state integer NOT NULL DEFAULT 0 CHECK (state IN (0, 1, 2, 3)),
  due_at timestamptz NOT NULL DEFAULT now(),
  stability double precision NOT NULL DEFAULT 0.0,
  difficulty double precision NOT NULL DEFAULT 0.0,
  reps integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.learning_review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  items_planned integer NOT NULL DEFAULT 0,
  items_completed integer NOT NULL DEFAULT 0,
  quiz_session_id uuid REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  question_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[]
);

CREATE TABLE IF NOT EXISTS public.learning_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_item_id uuid NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_session_id uuid REFERENCES public.learning_review_sessions(id) ON DELETE SET NULL,
  request_id text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  rating integer NOT NULL CHECK (rating IN (1, 2, 3, 4)),
  was_correct boolean NOT NULL,
  scheduled_days integer NOT NULL,
  previous_due_at timestamptz NOT NULL,
  next_due_at timestamptz NOT NULL,
  UNIQUE(user_id, request_id)
);

CREATE INDEX IF NOT EXISTS learning_items_user_due_idx
ON public.learning_items (user_id, due_at, state);

CREATE INDEX IF NOT EXISTS learning_items_document_id_idx
ON public.learning_items (document_id);

CREATE INDEX IF NOT EXISTS learning_review_sessions_user_document_idx
ON public.learning_review_sessions (user_id, document_id, started_at DESC);

CREATE INDEX IF NOT EXISTS learning_reviews_user_reviewed_at_idx
ON public.learning_reviews (user_id, reviewed_at DESC);

ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own learning items" ON public.learning_items;
CREATE POLICY "Users can manage their own learning items"
ON public.learning_items FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own review sessions" ON public.learning_review_sessions;
CREATE POLICY "Users can manage their own review sessions"
ON public.learning_review_sessions FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own learning reviews" ON public.learning_reviews;
CREATE POLICY "Users can manage their own learning reviews"
ON public.learning_reviews FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.learning_items FROM anon, authenticated;
REVOKE ALL ON public.learning_review_sessions FROM anon, authenticated;
REVOKE ALL ON public.learning_reviews FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.learning_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.learning_review_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.learning_reviews TO authenticated;

GRANT ALL ON public.learning_items TO service_role;
GRANT ALL ON public.learning_review_sessions TO service_role;
GRANT ALL ON public.learning_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_learning_items(p_user_id uuid, p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_role text := auth.role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized' USING errcode = '42501';
  END IF;

  IF v_role = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized user mismatch' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = p_document_id
      AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Document not found or unauthorized' USING errcode = '42501';
  END IF;

  INSERT INTO public.learning_items (user_id, document_id, question_id)
  SELECT p_user_id, p_document_id, q.id
  FROM public.questions q
  WHERE q.document_id = p_document_id
  ON CONFLICT (user_id, question_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_learning_review(
  p_user_id uuid,
  p_learning_item_id uuid,
  p_request_id text,
  p_review_session_id uuid,
  p_state integer,
  p_due_at timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_reps integer,
  p_lapses integer,
  p_rating integer,
  p_was_correct boolean,
  p_scheduled_days integer,
  p_previous_due_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_role text := auth.role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized' USING errcode = '42501';
  END IF;

  IF v_role = 'authenticated' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized user mismatch' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.learning_items li
    WHERE li.id = p_learning_item_id
      AND li.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Learning item not found or unauthorized' USING errcode = '42501';
  END IF;

  IF p_review_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.learning_review_sessions lrs
    WHERE lrs.id = p_review_session_id
      AND lrs.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Review session not found or unauthorized' USING errcode = '42501';
  END IF;

  INSERT INTO public.learning_reviews (
    learning_item_id,
    user_id,
    review_session_id,
    request_id,
    rating,
    was_correct,
    scheduled_days,
    previous_due_at,
    next_due_at
  ) VALUES (
    p_learning_item_id,
    p_user_id,
    p_review_session_id,
    p_request_id,
    p_rating,
    p_was_correct,
    p_scheduled_days,
    p_previous_due_at,
    p_due_at
  );

  UPDATE public.learning_items
  SET state = p_state,
      due_at = p_due_at,
      stability = p_stability,
      difficulty = p_difficulty,
      reps = p_reps,
      lapses = p_lapses,
      last_reviewed_at = now()
  WHERE id = p_learning_item_id
    AND user_id = p_user_id;

  IF p_review_session_id IS NOT NULL THEN
    UPDATE public.learning_review_sessions
    SET items_completed = items_completed + 1
    WHERE id = p_review_session_id
      AND user_id = p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_learning_items(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_learning_items(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_learning_review(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_learning_review(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
