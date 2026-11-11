-- Security hardening for privileged RPCs and learning data.
-- Apply through the Supabase migration workflow after reviewing the target project.

-- The worker is the only caller of this queue-claiming SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.claim_ai_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_job() TO service_role;

-- Generated content is persisted only by the trusted service-role worker.
CREATE OR REPLACE FUNCTION public.save_generated_notes(
    p_job_id uuid,
    p_user_id uuid,
    p_document_id uuid,
    p_summary text,
    p_key_points text[],
    p_topics jsonb[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_note_id uuid;
    v_topic jsonb;
    v_source_chunk_index integer;
    v_first_source_chunk_id uuid;
BEGIN
    IF length(COALESCE(p_summary, '')) > 50000
       OR COALESCE(cardinality(p_key_points), 0) > 100
       OR COALESCE(cardinality(p_topics), 0) > 100 THEN
        RAISE EXCEPTION 'Generated notes exceed allowed limits';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.ai_jobs j
        JOIN public.documents d ON d.id = j.document_id
        WHERE j.id = p_job_id
          AND j.user_id = p_user_id
          AND j.document_id = p_document_id
          AND d.user_id = p_user_id
          AND j.status = 'processing'
    ) THEN
        RAISE EXCEPTION 'Unauthorized or invalid generation job';
    END IF;

    INSERT INTO public.notes (document_id, content)
    VALUES (
        p_document_id,
        '# Summary' || E'\n' || COALESCE(p_summary, '') ||
        E'\n\n' || '# Key Points' || E'\n' ||
        array_to_string(COALESCE(p_key_points, ARRAY[]::text[]), E'\n- ')
    )
    RETURNING id INTO v_note_id;

    FOREACH v_topic IN ARRAY COALESCE(p_topics, ARRAY[]::jsonb[])
    LOOP
        v_source_chunk_index := NULLIF(v_topic->'sources'->0->>'chunkIndex', '')::integer;

        SELECT dc.id INTO v_first_source_chunk_id
        FROM public.document_chunks dc
        WHERE dc.document_id = p_document_id
          AND dc.chunk_index = v_source_chunk_index
        LIMIT 1;

        IF v_first_source_chunk_id IS NULL
           OR length(COALESCE(v_topic->>'name', '')) NOT BETWEEN 1 AND 200
           OR length(COALESCE(v_topic->>'description', '')) > 10000 THEN
            RAISE EXCEPTION 'Invalid generated topic or source citation';
        END IF;

        INSERT INTO public.topics (document_id, name, description, source_chunk_id)
        VALUES (
            p_document_id,
            v_topic->>'name',
            v_topic->>'description',
            v_first_source_chunk_id
        );
    END LOOP;

    UPDATE public.ai_jobs
    SET status = 'completed', completed_at = now()
    WHERE id = p_job_id
      AND user_id = p_user_id
      AND document_id = p_document_id
      AND status = 'processing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Generation job state changed unexpectedly';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_generated_quiz(
    p_job_id uuid,
    p_user_id uuid,
    p_document_id uuid,
    p_questions jsonb[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_question jsonb;
    v_source_chunk_index integer;
    v_first_source_chunk_id uuid;
    v_options_array text[];
    v_correct_answer_text text;
    v_correct_answer_index integer;
BEGIN
    IF COALESCE(cardinality(p_questions), 0) NOT BETWEEN 5 AND 100 THEN
        RAISE EXCEPTION 'Generated quiz question count is outside allowed limits';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.ai_jobs j
        JOIN public.documents d ON d.id = j.document_id
        WHERE j.id = p_job_id
          AND j.user_id = p_user_id
          AND j.document_id = p_document_id
          AND d.user_id = p_user_id
          AND j.status = 'processing'
    ) THEN
        RAISE EXCEPTION 'Unauthorized or invalid generation job';
    END IF;

    FOREACH v_question IN ARRAY COALESCE(p_questions, ARRAY[]::jsonb[])
    LOOP
        v_source_chunk_index := NULLIF(v_question->'sources'->0->>'chunkIndex', '')::integer;

        SELECT dc.id INTO v_first_source_chunk_id
        FROM public.document_chunks dc
        WHERE dc.document_id = p_document_id
          AND dc.chunk_index = v_source_chunk_index
        LIMIT 1;

        IF v_first_source_chunk_id IS NULL
           OR length(COALESCE(v_question->>'questionText', '')) NOT BETWEEN 1 AND 2000
           OR length(COALESCE(v_question->>'explanation', '')) > 10000 THEN
            RAISE EXCEPTION 'Invalid generated question or source citation';
        END IF;

        SELECT array_agg(x)
        INTO v_options_array
        FROM jsonb_array_elements_text(v_question->'options') AS x;

        v_correct_answer_index := (v_question->>'correctAnswerIndex')::integer;

        IF v_options_array IS NULL
           OR cardinality(v_options_array) <> 4
           OR v_correct_answer_index < 0
           OR v_correct_answer_index > 3
           OR EXISTS (SELECT 1 FROM unnest(v_options_array) option_text WHERE length(option_text) NOT BETWEEN 1 AND 500) THEN
            RAISE EXCEPTION 'Invalid generated question options';
        END IF;

        v_correct_answer_text := v_options_array[v_correct_answer_index + 1];

        INSERT INTO public.questions (
            document_id, question_text, options, correct_answer,
            explanation, difficulty, source_chunk_id
        )
        VALUES (
            p_document_id,
            v_question->>'questionText',
            to_jsonb(v_options_array),
            v_correct_answer_text,
            v_question->>'explanation',
            'medium',
            v_first_source_chunk_id
        );
    END LOOP;

    UPDATE public.ai_jobs
    SET status = 'completed', completed_at = now()
    WHERE id = p_job_id
      AND user_id = p_user_id
      AND document_id = p_document_id
      AND status = 'processing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Generation job state changed unexpectedly';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_generated_notes(uuid, uuid, uuid, text, text[], jsonb[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_generated_quiz(uuid, uuid, uuid, jsonb[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_generated_notes(uuid, uuid, uuid, text, text[], jsonb[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_generated_quiz(uuid, uuid, uuid, jsonb[]) TO service_role;

-- Learning RPCs retain SECURITY INVOKER and authenticated-user support.
-- They validate the JWT identity in the function body and cannot act for another user.
CREATE OR REPLACE FUNCTION public.ensure_learning_items(p_user_id uuid, p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_claims jsonb := auth.jwt();
BEGIN
    IF COALESCE(v_claims->>'role', '') <> 'service_role' THEN
        IF auth.uid() IS NULL
           OR auth.uid() IS DISTINCT FROM p_user_id
           OR COALESCE(v_claims->>'is_anonymous', 'false') = 'true' THEN
            RAISE EXCEPTION 'Unauthorized' USING errcode = '42501';
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = p_document_id AND d.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized document' USING errcode = '42501';
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
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_claims jsonb := auth.jwt();
    v_document_id uuid;
BEGIN
    IF COALESCE(v_claims->>'role', '') <> 'service_role' THEN
        IF auth.uid() IS NULL
           OR auth.uid() IS DISTINCT FROM p_user_id
           OR COALESCE(v_claims->>'is_anonymous', 'false') = 'true' THEN
            RAISE EXCEPTION 'Unauthorized' USING errcode = '42501';
        END IF;
    END IF;

    IF p_state NOT BETWEEN 0 AND 3
       OR p_rating NOT BETWEEN 1 AND 4
       OR p_reps < 0
       OR p_lapses < 0
       OR p_scheduled_days < 0
       OR p_stability IS NULL OR p_stability < 0 OR p_stability > 1000000
       OR p_difficulty IS NULL OR p_difficulty < 0 OR p_difficulty > 10
       OR p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 1 AND 128 THEN
        RAISE EXCEPTION 'Invalid review data';
    END IF;

    SELECT li.document_id INTO v_document_id
    FROM public.learning_items li
    WHERE li.id = p_learning_item_id
      AND li.user_id = p_user_id
    FOR UPDATE;

    IF v_document_id IS NULL THEN
        RAISE EXCEPTION 'Learning item not found or unauthorized' USING errcode = '42501';
    END IF;

    IF p_review_session_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.learning_review_sessions s
        WHERE s.id = p_review_session_id
          AND s.user_id = p_user_id
          AND s.document_id = v_document_id
    ) THEN
        RAISE EXCEPTION 'Review session not found or unauthorized' USING errcode = '42501';
    END IF;

    INSERT INTO public.learning_reviews (
        learning_item_id, user_id, review_session_id, request_id,
        rating, was_correct, scheduled_days, previous_due_at, next_due_at
    ) VALUES (
        p_learning_item_id, p_user_id, p_review_session_id, p_request_id,
        p_rating, p_was_correct, p_scheduled_days, p_previous_due_at, p_due_at
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
          AND user_id = p_user_id
          AND document_id = v_document_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_learning_items(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_learning_review(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_learning_items(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_learning_review(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz) TO authenticated, service_role;

-- Remove unnecessary anonymous table privileges. RLS remains enabled for authenticated users.
REVOKE ALL ON TABLE public.learning_items FROM anon;
REVOKE ALL ON TABLE public.learning_review_sessions FROM anon;
REVOKE ALL ON TABLE public.learning_reviews FROM anon;
