


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."claim_ai_job"() RETURNS TABLE("id" "uuid", "user_id" "uuid", "document_id" "uuid", "operation" "text", "idempotency_key" "text", "status" "text", "started_at" timestamp with time zone, "completed_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  claimed_job_id uuid;
begin
  -- Find one queued job, lock it, and update it to processing
  update public.ai_jobs
  set 
    status = 'processing',
    started_at = now()
  where id = (
    select aj.id
    from public.ai_jobs aj
    where aj.status = 'queued'
    order by aj.created_at asc
    for update skip locked
    limit 1
  )
  returning ai_jobs.id into claimed_job_id;

  -- Return the claimed row (or nothing if no job found)
  return query
  select *
  from public.ai_jobs
  where public.ai_jobs.id = claimed_job_id;
end;
$$;


ALTER FUNCTION "public"."claim_ai_job"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_document_upload"("p_document_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_doc_status text;
    v_job_id uuid;
begin
    -- Check if document exists and belongs to user
    select status into v_doc_status
    from public.documents
    where id = p_document_id and user_id = p_user_id
    for update; -- Lock the row

    if not found then
        raise exception 'Document not found or unauthorized' using errcode = 'P0002';
    end if;

    if v_doc_status not in ('uploaded', 'failed', 'cancelled') then
        raise exception 'Document is currently in % state', v_doc_status using errcode = 'P0001';
    end if;

    -- 1. Mark document as queued
    update public.documents
    set status = 'queued',
        updated_at = now()
    where id = p_document_id;

    -- 2. Insert extract_text job
    -- This relies on the unique constraint (user_id, idempotency_key) to prevent duplicates.
    insert into public.ai_jobs (
        user_id,
        document_id,
        operation,
        idempotency_key,
        status,
        generation_version
    ) values (
        p_user_id,
        p_document_id,
        'extract_text',
        p_idempotency_key,
        'queued',
        1
    ) returning id into v_job_id;
    
    return v_job_id;
end;
$$;


ALTER FUNCTION "public"."confirm_document_upload"("p_document_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  
  insert into public.user_entitlements (user_id, tier)
  values (new.id, 'free');
  
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_document_chunks"("p_query" "text", "p_authorized_document_ids" "uuid"[], "p_user_id" "uuid", "p_limit" integer DEFAULT 20) RETURNS TABLE("id" "uuid", "document_id" "uuid", "chunk_index" integer, "content" "text")
    LANGUAGE "plpgsql"
    AS $$
begin
  -- If called from an authenticated client (not service_role), enforce auth matches p_user_id
  if auth.role() = 'authenticated' and auth.uid() != p_user_id then
    raise exception 'Unauthorized user mismatch';
  end if;

  if p_query is null or p_query = '' then
    -- Full-context retrieval: return all chunks for the given documents in order
    return query
    select 
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    where d.user_id = p_user_id -- Strict JOIN
      and dc.document_id = any(p_authorized_document_ids)
    order by dc.document_id, dc.chunk_index asc
    limit p_limit;
  else
    -- Lexical retrieval: return most relevant chunks
    return query
    select 
      dc.id,
      dc.document_id,
      dc.chunk_index,
      dc.content
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    where d.user_id = p_user_id -- Strict JOIN
      and dc.document_id = any(p_authorized_document_ids)
      and to_tsvector('english', dc.content) @@ plainto_tsquery('english', p_query)
    order by ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', p_query)) desc, dc.chunk_index asc
    limit p_limit;
  end if;
end;
$$;


ALTER FUNCTION "public"."search_document_chunks"("p_query" "text", "p_authorized_document_ids" "uuid"[], "p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_question_topic_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_question_document_id uuid;
  v_topic_document_id uuid;
begin
  select document_id into v_question_document_id from public.questions where id = new.question_id;
  select document_id into v_topic_document_id from public.topics where id = new.topic_id;
  if v_question_document_id is distinct from v_topic_document_id then
    raise exception 'Data Integrity Violation: Question and topic must belong to the same document.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_question_topic_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_quiz_answer_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_attempt_doc_id uuid;
  v_question_doc_id uuid;
begin
  select document_id into v_attempt_doc_id from public.quiz_attempts where id = new.attempt_id;
  select document_id into v_question_doc_id from public.questions where id = new.question_id;
  if v_attempt_doc_id != v_question_doc_id then
    raise exception 'Data Integrity Violation: Question does not belong to the same document as the Quiz Attempt.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_quiz_answer_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_quiz_attempt_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_document_owner_id uuid;
begin
  select user_id into v_document_owner_id from public.documents where id = new.document_id;
  if v_document_owner_id is distinct from new.user_id then
    raise exception 'Data Integrity Violation: Quiz attempt user must own the document.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_quiz_attempt_ownership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_topic_mastery_ownership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_document_owner_id uuid;
begin
  select d.user_id into v_document_owner_id 
  from public.topics t
  join public.documents d on t.document_id = d.id
  where t.id = new.topic_id;
  
  if v_document_owner_id is distinct from new.user_id then
    raise exception 'Data Integrity Violation: Topic mastery user must own the document associated with the topic.';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."validate_topic_mastery_ownership"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_credit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "entry_type" "text" NOT NULL,
    "credits" integer NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "ai_credit_ledger_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['RESERVATION'::"text", 'CHARGE'::"text", 'REFUND'::"text", 'ADJUSTMENT'::"text"])))
);


ALTER TABLE "public"."ai_credit_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_generation_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "status" "text" NOT NULL,
    "model" "text" NOT NULL,
    "schema_version" "text" NOT NULL,
    "prompt_version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "ai_generation_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ai_generation_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "operation" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "generation_version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "ai_jobs_operation_check" CHECK (("operation" = ANY (ARRAY['extract_text'::"text", 'generate_notes'::"text", 'generate_quiz'::"text", 'chat'::"text"]))),
    CONSTRAINT "ai_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ai_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "operation" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "request_id" "text",
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "completed_at" timestamp with time zone,
    "usage_metadata" "jsonb"
);


ALTER TABLE "public"."ai_usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_citations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interaction_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "source_chunk_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."chat_citations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "billing_job_id" "uuid",
    "document_version" integer DEFAULT 1 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "chat_interactions_status_check" CHECK (("status" = ANY (ARRAY['generating'::"text", 'completed'::"text", 'aborted'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."chat_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interaction_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "chunk_index" integer NOT NULL,
    "page_number" integer,
    "section_title" "text",
    "content" "text" NOT NULL,
    "token_count" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."document_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "generation_version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "documents_status_check" CHECK (("status" = ANY (ARRAY['uploaded'::"text", 'queued'::"text", 'extracting'::"text", 'analyzing'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "generation_batch_id" "uuid"
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preferences" (
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'system'::"text",
    "study_goal" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "auto_generate" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_topics" (
    "question_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL
);


ALTER TABLE "public"."question_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "question_text" "text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "correct_answer" "text" NOT NULL,
    "explanation" "text",
    "difficulty" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "generation_batch_id" "uuid",
    "source_chunk_id" "uuid" NOT NULL,
    CONSTRAINT "questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "selected_answer" "text" NOT NULL,
    "is_correct" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."quiz_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "score" integer DEFAULT 0,
    "total_questions" integer NOT NULL,
    "started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "completed_at" timestamp with time zone,
    "generation_batch_id" "uuid",
    CONSTRAINT "quiz_attempts_check" CHECK (("score" <= "total_questions")),
    CONSTRAINT "quiz_attempts_score_check" CHECK (("score" >= 0)),
    CONSTRAINT "quiz_attempts_total_questions_check" CHECK (("total_questions" > 0))
);


ALTER TABLE "public"."quiz_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topic_mastery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "mastery_score" double precision DEFAULT 0.0,
    "confidence" double precision DEFAULT 0.0,
    "attempts" integer DEFAULT 0,
    "last_reviewed_at" timestamp with time zone,
    CONSTRAINT "topic_mastery_attempts_check" CHECK (("attempts" >= 0)),
    CONSTRAINT "topic_mastery_confidence_check" CHECK ((("confidence" >= (0.0)::double precision) AND ("confidence" <= (1.0)::double precision))),
    CONSTRAINT "topic_mastery_mastery_score_check" CHECK ((("mastery_score" >= (0.0)::double precision) AND ("mastery_score" <= (1.0)::double precision)))
);


ALTER TABLE "public"."topic_mastery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "generation_batch_id" "uuid",
    "source_chunk_id" "uuid" NOT NULL
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_entitlements" (
    "user_id" "uuid" NOT NULL,
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "user_entitlements_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'premium'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."user_entitlements" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_credit_ledger"
    ADD CONSTRAINT "ai_credit_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_generation_batches"
    ADD CONSTRAINT "ai_generation_batches_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."ai_generation_batches"
    ADD CONSTRAINT "ai_generation_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_logs"
    ADD CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_citations"
    ADD CONSTRAINT "chat_citations_message_id_alias_key" UNIQUE ("message_id", "alias");



ALTER TABLE ONLY "public"."chat_citations"
    ADD CONSTRAINT "chat_citations_message_id_source_chunk_id_key" UNIQUE ("message_id", "source_chunk_id");



ALTER TABLE ONLY "public"."chat_citations"
    ADD CONSTRAINT "chat_citations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_interactions"
    ADD CONSTRAINT "chat_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_interactions"
    ADD CONSTRAINT "chat_interactions_user_id_request_id_key" UNIQUE ("user_id", "request_id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_document_id_key" UNIQUE ("user_id", "document_id");



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preferences"
    ADD CONSTRAINT "preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_topics"
    ADD CONSTRAINT "question_topics_pkey" PRIMARY KEY ("question_id", "topic_id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_answers"
    ADD CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_mastery"
    ADD CONSTRAINT "topic_mastery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_mastery"
    ADD CONSTRAINT "topic_mastery_user_id_topic_id_key" UNIQUE ("user_id", "topic_id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_answers"
    ADD CONSTRAINT "unique_attempt_question" UNIQUE ("attempt_id", "question_id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_ai_credit_ledger_user_id" ON "public"."ai_credit_ledger" USING "btree" ("user_id");



CREATE INDEX "idx_ai_jobs_status" ON "public"."ai_jobs" USING "btree" ("status");



CREATE INDEX "idx_ai_jobs_user_id" ON "public"."ai_jobs" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_ai_jobs_user_idempotency" ON "public"."ai_jobs" USING "btree" ("user_id", "idempotency_key");



CREATE INDEX "idx_ai_usage_user_created" ON "public"."ai_usage_logs" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_chat_citations_message" ON "public"."chat_citations" USING "btree" ("message_id");



CREATE INDEX "idx_chat_interactions_user_req" ON "public"."chat_interactions" USING "btree" ("user_id", "request_id");



CREATE INDEX "idx_chat_messages_conv_created" ON "public"."chat_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_chat_messages_interaction" ON "public"."chat_messages" USING "btree" ("interaction_id");



CREATE INDEX "idx_chat_messages_user_id" ON "public"."chat_messages" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user_doc" ON "public"."conversations" USING "btree" ("user_id", "document_id");



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_document_chunks_document_id" ON "public"."document_chunks" USING "btree" ("document_id");



CREATE UNIQUE INDEX "idx_document_chunks_order" ON "public"."document_chunks" USING "btree" ("document_id", "chunk_index");



CREATE INDEX "idx_documents_user_id" ON "public"."documents" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_notes_batch_unique" ON "public"."notes" USING "btree" ("generation_batch_id") WHERE ("generation_batch_id" IS NOT NULL);



CREATE INDEX "idx_notes_document_id" ON "public"."notes" USING "btree" ("document_id");



CREATE INDEX "idx_question_topics_question_id" ON "public"."question_topics" USING "btree" ("question_id");



CREATE INDEX "idx_question_topics_topic_id" ON "public"."question_topics" USING "btree" ("topic_id");



CREATE INDEX "idx_questions_batch" ON "public"."questions" USING "btree" ("generation_batch_id");



CREATE INDEX "idx_questions_document_id" ON "public"."questions" USING "btree" ("document_id");



CREATE INDEX "idx_quiz_answers_attempt_id" ON "public"."quiz_answers" USING "btree" ("attempt_id");



CREATE UNIQUE INDEX "idx_quiz_attempts_single_active" ON "public"."quiz_attempts" USING "btree" ("user_id", "document_id") WHERE ("completed_at" IS NULL);



CREATE INDEX "idx_quiz_attempts_user_id" ON "public"."quiz_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_topic_mastery_user_id" ON "public"."topic_mastery" USING "btree" ("user_id");



CREATE INDEX "idx_topics_batch" ON "public"."topics" USING "btree" ("generation_batch_id");



CREATE INDEX "idx_topics_document_id" ON "public"."topics" USING "btree" ("document_id");



CREATE UNIQUE INDEX "idx_topics_document_name" ON "public"."topics" USING "btree" ("document_id", "lower"("name"));



CREATE OR REPLACE TRIGGER "set_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_preferences_updated_at" BEFORE UPDATE ON "public"."preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_user_entitlements_updated_at" BEFORE UPDATE ON "public"."user_entitlements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "validate_question_topic_context_trigger" BEFORE INSERT OR UPDATE OF "question_id", "topic_id" ON "public"."question_topics" FOR EACH ROW EXECUTE FUNCTION "public"."validate_question_topic_context"();



CREATE OR REPLACE TRIGGER "validate_quiz_answer_context_trigger" BEFORE INSERT OR UPDATE OF "attempt_id", "question_id" ON "public"."quiz_answers" FOR EACH ROW EXECUTE FUNCTION "public"."validate_quiz_answer_context"();



CREATE OR REPLACE TRIGGER "validate_quiz_attempt_ownership_trigger" BEFORE INSERT OR UPDATE OF "document_id", "user_id" ON "public"."quiz_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."validate_quiz_attempt_ownership"();



CREATE OR REPLACE TRIGGER "validate_topic_mastery_ownership_trigger" BEFORE INSERT OR UPDATE OF "topic_id", "user_id" ON "public"."topic_mastery" FOR EACH ROW EXECUTE FUNCTION "public"."validate_topic_mastery_ownership"();



ALTER TABLE ONLY "public"."ai_credit_ledger"
    ADD CONSTRAINT "ai_credit_ledger_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_credit_ledger"
    ADD CONSTRAINT "ai_credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_generation_batches"
    ADD CONSTRAINT "ai_generation_batches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_generation_batches"
    ADD CONSTRAINT "ai_generation_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_logs"
    ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_citations"
    ADD CONSTRAINT "chat_citations_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."chat_interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_citations"
    ADD CONSTRAINT "chat_citations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_citations"
    ADD CONSTRAINT "chat_citations_source_chunk_id_fkey" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_interactions"
    ADD CONSTRAINT "chat_interactions_billing_job_id_fkey" FOREIGN KEY ("billing_job_id") REFERENCES "public"."ai_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_interactions"
    ADD CONSTRAINT "chat_interactions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_interactions"
    ADD CONSTRAINT "chat_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."chat_interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_chunks"
    ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_generation_batch_id_fkey" FOREIGN KEY ("generation_batch_id") REFERENCES "public"."ai_generation_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferences"
    ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_topics"
    ADD CONSTRAINT "question_topics_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_topics"
    ADD CONSTRAINT "question_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_generation_batch_id_fkey" FOREIGN KEY ("generation_batch_id") REFERENCES "public"."ai_generation_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_source_chunk_id_fkey" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."document_chunks"("id");



ALTER TABLE ONLY "public"."quiz_answers"
    ADD CONSTRAINT "quiz_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_answers"
    ADD CONSTRAINT "quiz_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_generation_batch_id_fkey" FOREIGN KEY ("generation_batch_id") REFERENCES "public"."ai_generation_batches"("id");



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topic_mastery"
    ADD CONSTRAINT "topic_mastery_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topic_mastery"
    ADD CONSTRAINT "topic_mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_generation_batch_id_fkey" FOREIGN KEY ("generation_batch_id") REFERENCES "public"."ai_generation_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_source_chunk_id_fkey" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."document_chunks"("id");



ALTER TABLE ONLY "public"."user_entitlements"
    ADD CONSTRAINT "user_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own notes" ON "public"."notes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "notes"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own notes" ON "public"."notes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "notes"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own preferences" ON "public"."preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notes" ON "public"."notes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "notes"."document_id") AND ("documents"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "notes"."document_id") AND ("documents"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own preferences" ON "public"."preferences" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own AI jobs" ON "public"."ai_jobs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own batches" ON "public"."ai_generation_batches" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own chunks" ON "public"."document_chunks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_chunks"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own citations" ON "public"."chat_citations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_interactions" "i"
  WHERE (("i"."id" = "chat_citations"."interaction_id") AND ("i"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own entitlements" ON "public"."user_entitlements" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own interactions" ON "public"."chat_interactions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own ledger" ON "public"."ai_credit_ledger" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own messages" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notes" ON "public"."notes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "notes"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own preferences" ON "public"."preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own question topics" ON "public"."question_topics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."questions"
  WHERE (("questions"."id" = "question_topics"."question_id") AND ("questions"."document_id" IN ( SELECT "documents"."id"
           FROM "public"."documents"
          WHERE ("documents"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view own questions" ON "public"."questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "questions"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own quiz answers" ON "public"."quiz_answers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."quiz_attempts"
  WHERE (("quiz_attempts"."id" = "quiz_answers"."attempt_id") AND ("quiz_attempts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own quiz attempts" ON "public"."quiz_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own topic mastery" ON "public"."topic_mastery" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own topics" ON "public"."topics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "topics"."document_id") AND ("documents"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."ai_credit_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_generation_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_citations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topic_mastery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_entitlements" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ai_jobs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."documents";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."claim_ai_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_ai_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_ai_job"() TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_document_upload"("p_document_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_document_upload"("p_document_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_document_upload"("p_document_id" "uuid", "p_user_id" "uuid", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_document_chunks"("p_query" "text", "p_authorized_document_ids" "uuid"[], "p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_document_chunks"("p_query" "text", "p_authorized_document_ids" "uuid"[], "p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_document_chunks"("p_query" "text", "p_authorized_document_ids" "uuid"[], "p_user_id" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_question_topic_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_question_topic_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_quiz_answer_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_quiz_answer_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_quiz_attempt_ownership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_quiz_attempt_ownership"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_topic_mastery_ownership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_topic_mastery_ownership"() TO "service_role";


















GRANT ALL ON TABLE "public"."ai_credit_ledger" TO "anon";
GRANT ALL ON TABLE "public"."ai_credit_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_credit_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."ai_generation_batches" TO "anon";
GRANT ALL ON TABLE "public"."ai_generation_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_generation_batches" TO "service_role";



GRANT ALL ON TABLE "public"."ai_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ai_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."chat_citations" TO "anon";
GRANT ALL ON TABLE "public"."chat_citations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_citations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_interactions" TO "anon";
GRANT ALL ON TABLE "public"."chat_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."document_chunks" TO "anon";
GRANT ALL ON TABLE "public"."document_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."document_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."preferences" TO "anon";
GRANT ALL ON TABLE "public"."preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."preferences" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."question_topics" TO "anon";
GRANT ALL ON TABLE "public"."question_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."question_topics" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_answers" TO "anon";
GRANT ALL ON TABLE "public"."quiz_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_answers" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_attempts" TO "anon";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."topic_mastery" TO "anon";
GRANT ALL ON TABLE "public"."topic_mastery" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_mastery" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "anon";
GRANT ALL ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";



GRANT ALL ON TABLE "public"."user_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."user_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entitlements" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































