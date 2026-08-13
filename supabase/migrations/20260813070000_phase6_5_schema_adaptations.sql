-- ========================================================================================
-- RECALLMATE — PHASE 6.5: NOTES + QUIZ SCHEMA ADAPTATIONS
-- ========================================================================================

-- 1. Preserve closed-universe grounding natively in the schema.
-- Drop the free-form text column and add a foreign key constraint to document_chunks.

ALTER TABLE public.topics
ADD COLUMN source_chunk_id uuid NOT NULL REFERENCES public.document_chunks(id);

-- Enforce strict grounding for generated questions
ALTER TABLE public.questions
DROP COLUMN source_citation;

ALTER TABLE public.questions
ADD COLUMN source_chunk_id uuid NOT NULL REFERENCES public.document_chunks(id);

-- 2. Enforce quiz attempt answer uniqueness (idempotency)
ALTER TABLE public.quiz_answers
ADD CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id);

-- 3. Bind quiz attempt to specific generation batch
ALTER TABLE public.quiz_attempts
ADD COLUMN generation_batch_id uuid REFERENCES public.ai_generation_batches(id);

-- 4. Enforce one active attempt per user per document
CREATE UNIQUE INDEX idx_quiz_attempts_single_active ON public.quiz_attempts (user_id, document_id) WHERE completed_at IS NULL;
