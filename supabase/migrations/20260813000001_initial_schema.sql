-- ========================================================================================
-- RECALLMATE — PHASE 2: SUPABASE SCHEMA & MIGRATION (00001_initial_schema.sql)
-- ========================================================================================
-- This migration script initializes the full architecture including RLS, 
-- explicit relationships, AI usage logging, RAG chunks, and adaptive topics.
-- ========================================================================================

create extension if not exists "uuid-ossp";

-- ========================================================================================
-- 1. TABLES & SCHEMA DEFINITIONS
-- ========================================================================================

-- 1A. Profiles (Extends auth.users - Client Writable)
create table public.profiles (
  id uuid references auth.users (id) on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1B. User Entitlements (Server-managed billing/premium status)
create table public.user_entitlements (
  user_id uuid references auth.users (id) on delete cascade not null primary key,
  tier text not null default 'free' check (tier in ('free', 'premium', 'pro')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1C. Preferences (Client Writable)
create table public.preferences (
  user_id uuid references auth.users (id) on delete cascade not null primary key,
  theme text default 'system',
  study_goal text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1D. Documents (Private Files uploaded by user)
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  filename text not null,
  storage_path text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'queued', 'extracting', 'analyzing', 'generating', 'completed', 'failed', 'cancelled')),
  error_code text,
  error_message text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1E. Document Chunks (Server-managed RAG Citations)
create table public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents (id) on delete cascade not null,
  chunk_index integer not null,
  page_number integer,
  section_title text,
  content text not null,
  token_count integer,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index idx_document_chunks_order on public.document_chunks(document_id, chunk_index);

-- 1F. Notes (Client Writable)
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents (id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1G. Topics & Adaptive Mastery (Server-managed generation)
create table public.topics (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents (id) on delete cascade not null,
  name text not null,
  description text
);

create unique index idx_topics_document_name on public.topics (document_id, lower(name));

create table public.topic_mastery (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  topic_id uuid references public.topics (id) on delete cascade not null,
  mastery_score float default 0.0 check (mastery_score >= 0.0 and mastery_score <= 1.0),
  confidence float default 0.0 check (confidence >= 0.0 and confidence <= 1.0),
  attempts integer default 0 check (attempts >= 0),
  last_reviewed_at timestamp with time zone,
  unique(user_id, topic_id)
);

-- 1H. Questions & Topic Links (Server-managed)
create table public.questions (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents (id) on delete cascade not null,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  source_citation text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.question_topics (
  question_id uuid references public.questions (id) on delete cascade not null,
  topic_id uuid references public.topics (id) on delete cascade not null,
  primary key (question_id, topic_id)
);

-- 1I. Quiz Attempts & Answers (Server-managed to protect scoring integrity)
create table public.quiz_attempts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  document_id uuid references public.documents (id) on delete cascade not null,
  score integer default 0 check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  check (score <= total_questions)
);

create table public.quiz_answers (
  id uuid default gen_random_uuid() primary key,
  attempt_id uuid references public.quiz_attempts (id) on delete cascade not null,
  question_id uuid references public.questions (id) on delete cascade not null,
  selected_answer text not null,
  is_correct boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enforce Question <-> Topic document consistency
create or replace function public.validate_question_topic_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger validate_question_topic_context_trigger
  before insert or update of question_id, topic_id on public.question_topics
  for each row execute procedure public.validate_question_topic_context();

-- Enforce Quiz Attempt <-> Document ownership consistency
create or replace function public.validate_quiz_attempt_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger validate_quiz_attempt_ownership_trigger
  before insert or update of document_id, user_id on public.quiz_attempts
  for each row execute procedure public.validate_quiz_attempt_ownership();

-- Enforce Topic Mastery <-> Document ownership consistency
create or replace function public.validate_topic_mastery_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger validate_topic_mastery_ownership_trigger
  before insert or update of topic_id, user_id on public.topic_mastery
  for each row execute procedure public.validate_topic_mastery_ownership();

-- Enforce answer consistency via trigger (question must belong to the same document as the attempt)
create or replace function public.validate_quiz_answer_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger validate_quiz_answer_context_trigger
  before insert or update of attempt_id, question_id on public.quiz_answers
  for each row execute procedure public.validate_quiz_answer_context();

-- 1J. AI Jobs (Idempotency & Concurrency Protection - Server-managed)
create table public.ai_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  document_id uuid references public.documents (id) on delete cascade,
  operation text not null check (operation in ('extract_text', 'generate_notes', 'generate_quiz', 'chat')),
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Prevents duplicate jobs for the same user and idempotency key entirely, ensuring clean retry semantics
create unique index idx_ai_jobs_user_idempotency
on public.ai_jobs (user_id, idempotency_key);

-- 1K. AI Usage Logs (Cost tracking - Server only)
create table public.ai_usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete set null,
  operation text not null,
  provider text not null,
  model text not null,
  request_id text,
  status text not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  usage_metadata jsonb
);

-- ========================================================================================
-- 2. PERFORMANCE INDEXING
-- ========================================================================================
create index idx_documents_user_id on public.documents(user_id);
create index idx_document_chunks_document_id on public.document_chunks(document_id);
create index idx_notes_document_id on public.notes(document_id);
create index idx_questions_document_id on public.questions(document_id);
create index idx_question_topics_question_id on public.question_topics(question_id);
create index idx_question_topics_topic_id on public.question_topics(topic_id);
create index idx_quiz_attempts_user_id on public.quiz_attempts(user_id);
create index idx_quiz_answers_attempt_id on public.quiz_answers(attempt_id);
create index idx_topics_document_id on public.topics(document_id);
create index idx_topic_mastery_user_id on public.topic_mastery(user_id);
create index idx_ai_jobs_user_id on public.ai_jobs(user_id);
create index idx_ai_jobs_status on public.ai_jobs(status);
create index idx_ai_usage_user_created on public.ai_usage_logs(user_id, started_at desc);

-- ========================================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================================================
alter table public.profiles enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.preferences enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.notes enable row level security;
alter table public.questions enable row level security;
alter table public.question_topics enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.topics enable row level security;
alter table public.topic_mastery enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.ai_usage_logs enable row level security; -- Server only, no policies

-- PROFILES (Client Writable)
create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- USER ENTITLEMENTS (Server Writable Only)
create policy "Users can view own entitlements" on public.user_entitlements for select to authenticated using (auth.uid() = user_id);

-- PREFERENCES (Client Writable)
create policy "Users can view own preferences" on public.preferences for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own preferences" on public.preferences for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own preferences" on public.preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- DOCUMENTS (Server Managed - Clients can only SELECT. INSERT/UPDATE/DELETE are server-managed to orchestrate Storage cleanup and safe initialization)
create policy "Users can view own documents" on public.documents for select to authenticated using (auth.uid() = user_id);

-- NOTES (Client Writable)
create policy "Users can view own notes" on public.notes for select to authenticated using (
  exists (select 1 from public.documents where id = notes.document_id and user_id = auth.uid())
);
create policy "Users can insert own notes" on public.notes for insert to authenticated with check (
  exists (select 1 from public.documents where id = notes.document_id and user_id = auth.uid())
);
create policy "Users can update own notes" on public.notes for update to authenticated using (
  exists (select 1 from public.documents where id = notes.document_id and user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.documents where id = notes.document_id and user_id = (select auth.uid()))
);
create policy "Users can delete own notes" on public.notes for delete to authenticated using (
  exists (select 1 from public.documents where id = notes.document_id and user_id = auth.uid())
);

-- ========================================================================================
-- SERVER-MANAGED DATA (SELECT ONLY FOR CLIENTS)
-- To prevent forging/cheating, these tables are mutated via trusted Server Actions/API
-- ========================================================================================

-- DOCUMENT CHUNKS
create policy "Users can view own chunks" on public.document_chunks for select to authenticated using (
  exists (select 1 from public.documents where id = document_chunks.document_id and user_id = auth.uid())
);

-- QUESTIONS & QUESTION TOPICS
create policy "Users can view own questions" on public.questions for select to authenticated using (
  exists (select 1 from public.documents where id = questions.document_id and user_id = auth.uid())
);
create policy "Users can view own question topics" on public.question_topics for select to authenticated using (
  exists (select 1 from public.questions where id = question_topics.question_id and document_id in (
    select id from public.documents where user_id = auth.uid()
  ))
);

-- TOPICS & TOPIC MASTERY
create policy "Users can view own topics" on public.topics for select to authenticated using (
  exists (select 1 from public.documents where id = topics.document_id and user_id = auth.uid())
);
create policy "Users can view own topic mastery" on public.topic_mastery for select to authenticated using (auth.uid() = user_id);

-- QUIZ ATTEMPTS & ANSWERS
create policy "Users can view own quiz attempts" on public.quiz_attempts for select to authenticated using (auth.uid() = user_id);
create policy "Users can view own quiz answers" on public.quiz_answers for select to authenticated using (
  exists (select 1 from public.quiz_attempts where id = quiz_answers.attempt_id and user_id = auth.uid())
);

-- AI JOBS
create policy "Users can view own AI jobs" on public.ai_jobs for select to authenticated using (auth.uid() = user_id);

-- ========================================================================================
-- 4. STORAGE CONFIGURATION & BUCKET RLS
-- ========================================================================================
insert into storage.buckets (id, name, public) values ('study_materials', 'study_materials', false)
on conflict (id) do nothing;

create policy "Users can view their own study materials"
  on storage.objects for select to authenticated
  using (bucket_id = 'study_materials' and auth.uid()::text = owner_id);

create policy "Users can upload their own study materials"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'study_materials' and auth.uid()::text = owner_id);

-- Storage UPDATE and DELETE are server-managed to enforce lifecycle

-- ========================================================================================
-- 5. TRIGGERS
-- ========================================================================================

-- Automatically update updated_at timestamp
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger set_user_entitlements_updated_at before update on public.user_entitlements for each row execute procedure public.set_updated_at();
create trigger set_preferences_updated_at before update on public.preferences for each row execute procedure public.set_updated_at();
create trigger set_documents_updated_at before update on public.documents for each row execute procedure public.set_updated_at();

-- Auto-create profile and entitlement on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Revoke direct execute privileges from protected functions
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.validate_quiz_answer_context() from public, anon, authenticated;
revoke execute on function public.validate_question_topic_context() from public, anon, authenticated;
revoke execute on function public.validate_quiz_attempt_ownership() from public, anon, authenticated;
revoke execute on function public.validate_topic_mastery_ownership() from public, anon, authenticated;
