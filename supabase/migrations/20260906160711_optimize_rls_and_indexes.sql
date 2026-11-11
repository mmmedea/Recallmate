-- Reduce RLS auth re-evaluation and add missing foreign-key indexes.

DROP POLICY IF EXISTS "Users can view own ledger" ON public.ai_credit_ledger;
CREATE POLICY "Users can view own ledger" ON public.ai_credit_ledger
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own batches" ON public.ai_generation_batches;
CREATE POLICY "Users can view own batches" ON public.ai_generation_batches
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own AI jobs" ON public.ai_jobs;
CREATE POLICY "Users can view own AI jobs" ON public.ai_jobs
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Students manage their own calendar events" ON public.calendar_events;
CREATE POLICY "Students manage their own calendar events" ON public.calendar_events
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Students manage their own calendar reminders" ON public.calendar_reminders;
CREATE POLICY "Students manage their own calendar reminders" ON public.calendar_reminders
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own citations" ON public.chat_citations;
CREATE POLICY "Users can view own citations" ON public.chat_citations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.chat_interactions i
      WHERE i.id = chat_citations.interaction_id
        AND i.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own interactions" ON public.chat_interactions;
CREATE POLICY "Users can view own interactions" ON public.chat_interactions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
CREATE POLICY "Users can view own messages" ON public.chat_messages
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own chunks" ON public.document_chunks;
CREATE POLICY "Users can view own chunks" ON public.document_chunks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = document_chunks.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own learning items" ON public.learning_items;
DROP POLICY IF EXISTS "Users can manage their own learning items" ON public.learning_items;
CREATE POLICY "Users can manage their own learning items" ON public.learning_items
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own review sessions" ON public.learning_review_sessions;
DROP POLICY IF EXISTS "Users can manage their own review sessions" ON public.learning_review_sessions;
CREATE POLICY "Users can manage their own review sessions" ON public.learning_review_sessions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own learning reviews" ON public.learning_reviews;
DROP POLICY IF EXISTS "Users can manage their own learning reviews" ON public.learning_reviews;
CREATE POLICY "Users can manage their own learning reviews" ON public.learning_reviews
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = notes.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = notes.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = notes.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = notes.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = notes.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Students manage their own notifications" ON public.notifications;
CREATE POLICY "Students manage their own notifications" ON public.notifications
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own preferences" ON public.preferences;
CREATE POLICY "Users can view own preferences" ON public.preferences
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.preferences;
CREATE POLICY "Users can insert own preferences" ON public.preferences
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.preferences;
CREATE POLICY "Users can update own preferences" ON public.preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view own question topics" ON public.question_topics;
CREATE POLICY "Users can view own question topics" ON public.question_topics
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.questions q
      WHERE q.id = question_topics.question_id
        AND q.document_id IN (
          SELECT d.id
          FROM public.documents d
          WHERE d.user_id = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Users can view own questions" ON public.questions;
CREATE POLICY "Users can view own questions" ON public.questions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = questions.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own quiz answers" ON public.quiz_answers;
CREATE POLICY "Users can view own quiz answers" ON public.quiz_answers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_attempts qa
      WHERE qa.id = quiz_answers.attempt_id
        AND qa.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own reviewer documents" ON public.reviewer_documents;
CREATE POLICY "Users can manage their own reviewer documents" ON public.reviewer_documents
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own reviewer outputs" ON public.reviewer_outputs;
CREATE POLICY "Users can manage their own reviewer outputs" ON public.reviewer_outputs
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own topic mastery" ON public.topic_mastery;
CREATE POLICY "Users can view own topic mastery" ON public.topic_mastery
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own topics" ON public.topics;
CREATE POLICY "Users can view own topics" ON public.topics
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = topics.document_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view own entitlements" ON public.user_entitlements;
CREATE POLICY "Users can view own entitlements" ON public.user_entitlements
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS ai_jobs_parent_job_id_idx ON public.ai_jobs (parent_job_id);
CREATE INDEX IF NOT EXISTS calendar_reminders_user_id_idx ON public.calendar_reminders (user_id);
CREATE INDEX IF NOT EXISTS chat_citations_interaction_id_idx ON public.chat_citations (interaction_id);
CREATE INDEX IF NOT EXISTS chat_citations_source_chunk_id_idx ON public.chat_citations (source_chunk_id);
CREATE INDEX IF NOT EXISTS chat_interactions_billing_job_id_idx ON public.chat_interactions (billing_job_id);
CREATE INDEX IF NOT EXISTS chat_interactions_conversation_id_idx ON public.chat_interactions (conversation_id);
CREATE INDEX IF NOT EXISTS learning_items_document_id_idx ON public.learning_items (document_id);
CREATE INDEX IF NOT EXISTS learning_items_question_id_idx ON public.learning_items (question_id);
CREATE INDEX IF NOT EXISTS learning_review_sessions_document_id_idx ON public.learning_review_sessions (document_id);
CREATE INDEX IF NOT EXISTS learning_review_sessions_user_id_idx ON public.learning_review_sessions (user_id);
CREATE INDEX IF NOT EXISTS learning_reviews_learning_item_id_idx ON public.learning_reviews (learning_item_id);
CREATE INDEX IF NOT EXISTS learning_reviews_review_session_id_idx ON public.learning_reviews (review_session_id);
CREATE INDEX IF NOT EXISTS notifications_event_id_idx ON public.notifications (event_id);
CREATE INDEX IF NOT EXISTS questions_source_chunk_id_idx ON public.questions (source_chunk_id);
CREATE INDEX IF NOT EXISTS quiz_answers_question_id_idx ON public.quiz_answers (question_id);
CREATE INDEX IF NOT EXISTS reviewer_outputs_reviewer_document_id_idx ON public.reviewer_outputs (reviewer_document_id);
CREATE INDEX IF NOT EXISTS topics_source_chunk_id_idx ON public.topics (source_chunk_id);

NOTIFY pgrst, 'reload schema';
