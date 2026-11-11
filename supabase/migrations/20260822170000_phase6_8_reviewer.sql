-- ========================================================================================
-- RECALLMATE — PHASE 6.8: REVIEWER MAKER
-- ========================================================================================

-- 1. Update ai_jobs constraint (drop existing auto-generated check and recreate)
ALTER TABLE public.ai_jobs 
  DROP CONSTRAINT IF EXISTS ai_jobs_operation_check;
ALTER TABLE public.ai_jobs 
  ADD CONSTRAINT ai_jobs_operation_check 
  CHECK (operation IN ('extract_text', 'generate_notes', 'generate_quiz', 'chat', 'generate_reviewer'));


-- 2. Create reviewer_documents table (Canonical JSON Cache)
CREATE TABLE IF NOT EXISTS public.reviewer_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_ids uuid[] NOT NULL, -- The ordered source documents
    content jsonb NOT NULL, -- The validated ReviewerDocument JSON
    source_hash text NOT NULL,
    prompt_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- We might not need a strict unique constraint here because the outputs table references it
    -- but this allows efficient lookups for cache reuse.
    UNIQUE(user_id, source_hash, prompt_version)
);

-- 3. Create reviewer_outputs table (Rendered Binary Tracking)
CREATE TABLE IF NOT EXISTS public.reviewer_outputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_document_id uuid NOT NULL REFERENCES public.reviewer_documents(id) ON DELETE CASCADE,
    format text NOT NULL CHECK (format IN ('pdf', 'docx')),
    storage_path text NOT NULL,
    renderer_version text NOT NULL,
    layout_version text NOT NULL,
    idempotency_hash text NOT NULL,
    file_size integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure deterministic reproducibility
    UNIQUE(user_id, idempotency_hash)
);

-- 4. Create the private 'reviewers' storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reviewers', 'reviewers', false)
ON CONFLICT (id) DO NOTHING;

-- ========================================================================================
-- RLS POLICIES
-- ========================================================================================

ALTER TABLE public.reviewer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reviewer documents"
ON public.reviewer_documents FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own reviewer outputs"
ON public.reviewer_outputs FOR ALL TO authenticated 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT ALL ON TABLE public.reviewer_documents TO anon;
GRANT ALL ON TABLE public.reviewer_documents TO authenticated;
GRANT ALL ON TABLE public.reviewer_documents TO service_role;

GRANT ALL ON TABLE public.reviewer_outputs TO anon;
GRANT ALL ON TABLE public.reviewer_outputs TO authenticated;
GRANT ALL ON TABLE public.reviewer_outputs TO service_role;

-- Bucket RLS
CREATE POLICY "Users can view their own reviewers"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reviewers' AND (auth.uid() = owner));

CREATE POLICY "Users can insert their own reviewers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reviewers' AND (auth.uid() = owner));
