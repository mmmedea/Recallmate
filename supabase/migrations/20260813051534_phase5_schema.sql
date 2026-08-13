-- ========================================================================================
-- RECALLMATE — PHASE 5: AI PROTECTION & GENERATION SCHEMA
-- ========================================================================================

-- 1. AI Credit Ledger (Transactional accounting of AI usage)
create table public.ai_credit_ledger (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  job_id uuid references public.ai_jobs (id) on delete set null,
  entry_type text not null check (entry_type in ('RESERVATION', 'CHARGE', 'REFUND', 'ADJUSTMENT')),
  credits integer not null,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_ai_credit_ledger_user_id on public.ai_credit_ledger(user_id);

-- 2. AI Generation Batches (Database-level idempotency and schema tracking)
create table public.ai_generation_batches (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.ai_jobs (id) on delete cascade not null,
  user_id uuid references auth.users (id) on delete cascade not null,
  operation text not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  model text not null,
  schema_version text not null,
  prompt_version text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(job_id) -- Database uniqueness guarantees a job cannot generate multiple batches on retry
);

-- 3. Link generated outputs to batches
alter table public.notes add column generation_batch_id uuid references public.ai_generation_batches(id) on delete cascade;
create unique index idx_notes_batch_unique on public.notes(generation_batch_id) where generation_batch_id is not null;

alter table public.questions add column generation_batch_id uuid references public.ai_generation_batches(id) on delete cascade;
create index idx_questions_batch on public.questions(generation_batch_id);

alter table public.topics add column generation_batch_id uuid references public.ai_generation_batches(id) on delete cascade;
create index idx_topics_batch on public.topics(generation_batch_id);

-- 4. RLS Policies
alter table public.ai_credit_ledger enable row level security;
create policy "Users can view own ledger" on public.ai_credit_ledger for select to authenticated using (auth.uid() = user_id);
-- Insert/Update is Server-only to protect credit balances.

alter table public.ai_generation_batches enable row level security;
create policy "Users can view own batches" on public.ai_generation_batches for select to authenticated using (auth.uid() = user_id);
-- Insert/Update is Server-only.
