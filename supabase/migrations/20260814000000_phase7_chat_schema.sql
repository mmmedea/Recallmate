-- ========================================================================================
-- RECALLMATE — PHASE 7: CHAT SCHEMAS & RLS
-- ========================================================================================

-- 1. Conversations (Immutable Document Scope)
CREATE TABLE public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, document_id) -- One conversation per document per user in Phase 7
);

-- Index for RLS and lookup
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_user_doc ON public.conversations(user_id, document_id);

-- 2. Chat Interactions (Idempotency and Billing Bind)
CREATE TABLE public.chat_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  request_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('generating', 'completed', 'aborted', 'failed')),
  billing_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
  document_version integer NOT NULL DEFAULT 1,
  error_message text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone,
  UNIQUE(user_id, request_id) -- Strict idempotency envelope
);

CREATE INDEX idx_chat_interactions_user_req ON public.chat_interactions(user_id, request_id);

-- 3. Chat Messages
CREATE TABLE public.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id uuid REFERENCES public.chat_interactions(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for history loading
CREATE INDEX idx_chat_messages_interaction ON public.chat_messages(interaction_id);
CREATE INDEX idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);

-- 4. Chat Citations
CREATE TABLE public.chat_citations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id uuid REFERENCES public.chat_interactions(id) ON DELETE CASCADE NOT NULL,
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  source_chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE CASCADE NOT NULL,
  alias text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, source_chunk_id), -- A chunk is only cited once per message
  UNIQUE(message_id, alias)            -- An alias is strictly request-scoped
);

CREATE INDEX idx_chat_citations_message ON public.chat_citations(message_id);

-- ========================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================================================================

-- Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Insert/Update is Server-only to protect integrity.

-- Chat Interactions
ALTER TABLE public.chat_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own interactions" ON public.chat_interactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Insert/Update is Server-only.

-- Chat Messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Insert/Update is Server-only.

-- Chat Citations
ALTER TABLE public.chat_citations ENABLE ROW LEVEL SECURITY;
-- For citations, we base ownership on the interaction's user_id. 
CREATE POLICY "Users can view own citations" ON public.chat_citations FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.chat_interactions i
    WHERE i.id = chat_citations.interaction_id AND i.user_id = auth.uid()
  )
);
-- Insert/Update is Server-only.
