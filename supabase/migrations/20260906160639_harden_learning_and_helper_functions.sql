-- Mirror the production hardening for authenticated helper RPCs.
-- Keep worker/upload RPCs server-only in 20260906000000_lock_down_privileged_rpcs.sql.

CREATE OR REPLACE FUNCTION public.ensure_learning_items(p_user_id uuid, p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_query text,
  p_authorized_document_ids uuid[],
  p_user_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  page_number integer,
  section_title text,
  score real
)
LANGUAGE plpgsql
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

  IF p_query IS NULL OR p_query = '' THEN
    RETURN QUERY
    SELECT
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.page_number,
      dc.section_title,
      1.0::real AS score
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE d.user_id = p_user_id
      AND dc.document_id = ANY(p_authorized_document_ids)
    ORDER BY dc.document_id, dc.chunk_index ASC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content,
      dc.page_number,
      dc.section_title,
      pg_catalog.ts_rank(
        pg_catalog.to_tsvector('english', dc.content),
        pg_catalog.plainto_tsquery('english', p_query)
      )::real AS score
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE d.user_id = p_user_id
      AND dc.document_id = ANY(p_authorized_document_ids)
      AND pg_catalog.to_tsvector('english', dc.content) @@ pg_catalog.plainto_tsquery('english', p_query)
    ORDER BY score DESC, dc.chunk_index ASC
    LIMIT p_limit;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_ai_usage_log_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RAISE EXCEPTION 'Updates to ai_usage_logs are strictly forbidden. This table is an immutable ledger.';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_calendar_event_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_learning_items(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_learning_items(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_learning_review(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_learning_review(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_document_chunks(text, uuid[], uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_document_chunks(text, uuid[], uuid, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.prevent_ai_usage_log_updates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_ai_usage_log_updates() TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_calendar_event_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_calendar_event_updated_at() TO service_role;

NOTIFY pgrst, 'reload schema';
