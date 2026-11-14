-- Add indexes for foreign-key columns identified by the Supabase advisor.
CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_job_id_fk ON public.ai_credit_ledger (job_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_batches_user_id_fk ON public.ai_generation_batches (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_document_id_fk ON public.ai_jobs (document_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_user_id_fk ON public.calendar_reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_citations_interaction_id_fk ON public.chat_citations (interaction_id);
CREATE INDEX IF NOT EXISTS idx_chat_citations_source_chunk_id_fk ON public.chat_citations (source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_billing_job_id_fk ON public.chat_interactions (billing_job_id);
CREATE INDEX IF NOT EXISTS idx_chat_interactions_conversation_id_fk ON public.chat_interactions (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_document_id_fk ON public.conversations (document_id);
CREATE INDEX IF NOT EXISTS idx_learning_items_question_id_fk ON public.learning_items (question_id);
CREATE INDEX IF NOT EXISTS idx_learning_review_sessions_document_id_fk ON public.learning_review_sessions (document_id);
CREATE INDEX IF NOT EXISTS idx_learning_review_sessions_quiz_session_id_fk ON public.learning_review_sessions (quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_learning_reviews_learning_item_id_fk ON public.learning_reviews (learning_item_id);
CREATE INDEX IF NOT EXISTS idx_learning_reviews_review_session_id_fk ON public.learning_reviews (review_session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id_fk ON public.notifications (event_id);
CREATE INDEX IF NOT EXISTS idx_questions_question_bank_id_fk ON public.questions (question_bank_id);
CREATE INDEX IF NOT EXISTS idx_questions_source_chunk_id_fk ON public.questions (source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id_fk ON public.quiz_answers (question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_document_id_fk ON public.quiz_attempts (document_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_generation_batch_id_fk ON public.quiz_attempts (generation_batch_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_attempts_question_bank_id_fk ON public.quiz_question_attempts (question_bank_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_attempts_question_id_fk ON public.quiz_question_attempts (question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_attempts_quiz_session_id_fk ON public.quiz_question_attempts (quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_bank_source_block_id_fk ON public.quiz_question_bank (source_block_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_document_id_fk ON public.quiz_sessions (document_id);
CREATE INDEX IF NOT EXISTS idx_quiz_source_concepts_source_block_id_fk ON public.quiz_source_concepts (source_block_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_topic_id_fk ON public.topic_mastery (topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_source_chunk_id_fk ON public.topics (source_chunk_id);

-- Convert row-dependent auth.uid() calls into statement-level scalar subqueries.
-- Existing policy predicates, commands, and role scopes are preserved.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename, policyname) IN (
        ('chat_interactions', 'Users can view own interactions'),
        ('profiles', 'Users can view own profile'),
        ('user_entitlements', 'Users can view own entitlements'),
        ('preferences', 'Users can view own preferences'),
        ('preferences', 'Users can insert own preferences'),
        ('documents', 'Users can view own documents'),
        ('notes', 'Users can view own notes'),
        ('ai_generation_batches', 'Users can view own batches'),
        ('notes', 'Users can insert own notes'),
        ('notes', 'Users can delete own notes'),
        ('document_chunks', 'Users can view own chunks'),
        ('questions', 'Users can view own questions'),
        ('conversations', 'Users can view own conversations'),
        ('question_topics', 'Users can view own question topics'),
        ('topics', 'Users can view own topics'),
        ('topic_mastery', 'Users can view own topic mastery'),
        ('quiz_attempts', 'Users can view own quiz attempts'),
        ('quiz_answers', 'Users can view own quiz answers'),
        ('ai_jobs', 'Users can view own AI jobs'),
        ('ai_credit_ledger', 'Users can view own ledger'),
        ('chat_messages', 'Users can view own messages'),
        ('chat_citations', 'Users can view own citations'),
        ('calendar_events', 'Students manage their own calendar events'),
        ('calendar_reminders', 'Students manage their own calendar reminders'),
        ('notifications', 'Students manage their own notifications')
      )
  LOOP
    IF p.qual IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        p.policyname, p.schemaname, p.tablename,
        replace(p.qual, 'auth.uid()', '(select auth.uid())')
      );
    END IF;

    IF p.with_check IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        p.policyname, p.schemaname, p.tablename,
        replace(p.with_check, 'auth.uid()', '(select auth.uid())')
      );
    END IF;
  END LOOP;
END
$$;
