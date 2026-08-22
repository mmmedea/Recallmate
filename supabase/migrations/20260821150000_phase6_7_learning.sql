-- ========================================================================================
-- RECALLMATE — PHASE 6.7: LEARNING INTELLIGENCE (FSRS)
-- ========================================================================================

-- Ensure robust state tracking for FSRS items
CREATE TABLE IF NOT EXISTS public.learning_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    
    -- FSRS State (0 = New, 1 = Learning, 2 = Review, 3 = Relearning)
    state integer NOT NULL DEFAULT 0 CHECK (state IN (0, 1, 2, 3)),
    
    -- When the item should be reviewed next (UTC)
    due_at timestamptz NOT NULL DEFAULT now(),
    
    -- Core FSRS parameters
    stability double precision NOT NULL DEFAULT 0.0,
    difficulty double precision NOT NULL DEFAULT 0.0,
    
    -- History counts
    reps integer NOT NULL DEFAULT 0,
    lapses integer NOT NULL DEFAULT 0,
    
    last_reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Enforce one learning tracking row per question per user
    UNIQUE(user_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.learning_review_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    items_planned integer NOT NULL DEFAULT 0,
    items_completed integer NOT NULL DEFAULT 0
);

-- Immutable ledger for all spaced-repetition ratings, enabling future parameter optimization
CREATE TABLE IF NOT EXISTS public.learning_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_item_id uuid NOT NULL REFERENCES public.learning_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    review_session_id uuid REFERENCES public.learning_review_sessions(id) ON DELETE SET NULL,
    request_id text NOT NULL, -- Client-provided idempotency key
    
    reviewed_at timestamptz NOT NULL DEFAULT now(),
    
    -- FSRS Rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
    rating integer NOT NULL CHECK (rating IN (1, 2, 3, 4)),
    was_correct boolean NOT NULL,
    
    scheduled_days integer NOT NULL,
    previous_due_at timestamptz NOT NULL,
    next_due_at timestamptz NOT NULL,

    -- Enforce idempotency: prevent double-recording the same review request
    UNIQUE(user_id, request_id)
);

-- ========================================================================================
-- RLS POLICIES
-- ========================================================================================
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning items"
ON public.learning_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own learning items"
ON public.learning_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own review sessions"
ON public.learning_review_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own review sessions"
ON public.learning_review_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own learning reviews"
ON public.learning_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own learning reviews"
ON public.learning_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.learning_items TO anon;
GRANT ALL ON TABLE public.learning_items TO authenticated;
GRANT ALL ON TABLE public.learning_items TO service_role;

GRANT ALL ON TABLE public.learning_review_sessions TO anon;
GRANT ALL ON TABLE public.learning_review_sessions TO authenticated;
GRANT ALL ON TABLE public.learning_review_sessions TO service_role;

GRANT ALL ON TABLE public.learning_reviews TO anon;
GRANT ALL ON TABLE public.learning_reviews TO authenticated;
GRANT ALL ON TABLE public.learning_reviews TO service_role;

-- ========================================================================================
-- TRANSACTIONAL RPC
-- ========================================================================================

-- Initialize learning items for a document's questions idempotently
CREATE OR REPLACE FUNCTION public.ensure_learning_items(p_user_id uuid, p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.learning_items (user_id, document_id, question_id)
    SELECT p_user_id, p_document_id, q.id
    FROM public.questions q
    WHERE q.document_id = p_document_id
    ON CONFLICT (user_id, question_id) DO NOTHING;
END;
$$;

-- Atomically process a review (updating FSRS state and logging the review)
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
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Insert the review log (this will fail if p_request_id already exists for this user, providing idempotency)
    INSERT INTO public.learning_reviews (
        learning_item_id, user_id, review_session_id, request_id,
        rating, was_correct, scheduled_days, previous_due_at, next_due_at
    ) VALUES (
        p_learning_item_id, p_user_id, p_review_session_id, p_request_id,
        p_rating, p_was_correct, p_scheduled_days, p_previous_due_at, p_due_at
    );

    -- 2. Update the learning item state
    UPDATE public.learning_items
    SET 
        state = p_state,
        due_at = p_due_at,
        stability = p_stability,
        difficulty = p_difficulty,
        reps = p_reps,
        lapses = p_lapses,
        last_reviewed_at = now()
    WHERE id = p_learning_item_id AND user_id = p_user_id;

    -- 3. Optionally update session items_completed
    IF p_review_session_id IS NOT NULL THEN
        UPDATE public.learning_review_sessions
        SET items_completed = items_completed + 1
        WHERE id = p_review_session_id;
    END IF;
END;
$$;
