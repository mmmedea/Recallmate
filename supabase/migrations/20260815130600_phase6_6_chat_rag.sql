-- ========================================================================================
-- RECALLMATE — PHASE 6.6: MEDEA CHAT & RAG
-- ========================================================================================

-- Ensure composite uniqueness on chat_sessions for safe foreign keys
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    title text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Composite unique constraint to ensure chat_messages inherit the correct user_id
    UNIQUE(id, user_id)
);

CREATE TYPE chat_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_message_id text, -- Uniquely identifies the client's request to prevent duplicate processing
    role chat_role NOT NULL,
    content text NOT NULL,
    sources jsonb,
    generation_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
    prompt_version text,
    model text,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Enforce that the message belongs to the exact same user as the session
    FOREIGN KEY (session_id, user_id) REFERENCES public.chat_sessions(id, user_id) ON DELETE CASCADE,
    
    -- Idempotency constraint per session
    UNIQUE(session_id, client_message_id)
);

-- ========================================================================================
-- RLS POLICIES
-- ========================================================================================
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat sessions"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat sessions"
ON public.chat_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat sessions"
ON public.chat_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat sessions"
ON public.chat_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Chat Messages Policies
CREATE POLICY "Users can view messages in their own sessions"
ON public.chat_messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create messages in their own sessions"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Typically, users cannot update or delete messages, but if we allow it, it must be scoped.
CREATE POLICY "Users can delete messages in their own sessions"
ON public.chat_messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================================================================
-- UPDATE ai_jobs TO SUPPORT 'chat' OPERATION AND SYNCHRONOUS MODE
-- ========================================================================================
ALTER TABLE public.ai_jobs
ADD COLUMN IF NOT EXISTS execution_mode text DEFAULT 'async' CHECK (execution_mode IN ('async', 'synchronous'));

-- Let's define an RPC to atomically persist a generated assistant message
CREATE OR REPLACE FUNCTION public.save_chat_message(
    p_session_id uuid,
    p_user_id uuid,
    p_client_message_id text,
    p_role chat_role,
    p_content text,
    p_sources jsonb,
    p_generation_id uuid,
    p_prompt_version text,
    p_model text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id uuid;
BEGIN
    INSERT INTO public.chat_messages (
        session_id, 
        user_id, 
        client_message_id, 
        role, 
        content, 
        sources, 
        generation_id,
        prompt_version,
        model
    )
    VALUES (
        p_session_id,
        p_user_id,
        p_client_message_id,
        p_role,
        p_content,
        p_sources,
        p_generation_id,
        p_prompt_version,
        p_model
    )
    RETURNING id INTO v_message_id;

    -- Update session updated_at timestamp
    UPDATE public.chat_sessions
    SET updated_at = now()
    WHERE id = p_session_id;

    RETURN v_message_id;
END;
$$;
