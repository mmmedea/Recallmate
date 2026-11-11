-- RecallMate Reviewer Maker production schema, observability, and explicit job states.
-- This migration is intentionally self-healing because the real production project
-- may be missing the earlier Reviewer Maker base tables.

alter table public.ai_jobs
  drop constraint if exists ai_jobs_operation_check;

alter table public.ai_jobs
  add constraint ai_jobs_operation_check
  check (operation in ('extract_text', 'generate_notes', 'generate_quiz', 'chat', 'generate_reviewer'));

create table if not exists public.reviewer_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_ids uuid[] not null,
  content jsonb not null,
  source_hash text not null,
  prompt_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, source_hash, prompt_version)
);

create table if not exists public.reviewer_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_document_id uuid not null references public.reviewer_documents(id) on delete cascade,
  format text not null check (format in ('pdf', 'docx')),
  storage_path text not null,
  renderer_version text not null,
  layout_version text not null,
  idempotency_hash text not null,
  file_size integer,
  status text not null default 'completed',
  economy_reservation_key text,
  coin_cost integer,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_hash)
);

alter table if exists public.reviewer_documents
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.reviewer_outputs
  add column if not exists status text not null default 'completed',
  add column if not exists economy_reservation_key text,
  add column if not exists coin_cost integer,
  add column if not exists refunded_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.reviewer_outputs
  drop constraint if exists reviewer_outputs_status_check;

alter table if exists public.reviewer_outputs
  add constraint reviewer_outputs_status_check
  check (
    status in (
      'created',
      'coins_reserved',
      'extracting',
      'generating',
      'validating',
      'repairing',
      'rendering',
      'completed',
      'extraction_failed',
      'ai_failed',
      'qa_failed',
      'render_failed',
      'failed',
      'refunded'
    )
  );

insert into storage.buckets (id, name, public)
values ('reviewers', 'reviewers', false)
on conflict (id) do nothing;

alter table public.reviewer_documents enable row level security;
alter table public.reviewer_outputs enable row level security;

drop policy if exists "Users can manage their own reviewer documents" on public.reviewer_documents;
drop policy if exists "Users can manage their own reviewer outputs" on public.reviewer_outputs;

create policy "Users can manage their own reviewer documents"
on public.reviewer_documents
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage their own reviewer outputs"
on public.reviewer_outputs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.reviewer_documents from anon;
revoke all on table public.reviewer_outputs from anon;

grant select, insert, update, delete on table public.reviewer_documents to authenticated;
grant select, insert, update, delete on table public.reviewer_outputs to authenticated;
grant all on table public.reviewer_documents to service_role;
grant all on table public.reviewer_outputs to service_role;

create index if not exists reviewer_documents_user_created_idx
  on public.reviewer_documents (user_id, created_at desc);

create index if not exists reviewer_documents_metadata_gin_idx
  on public.reviewer_documents using gin (metadata);

create index if not exists reviewer_outputs_reviewer_document_id_idx
  on public.reviewer_outputs (reviewer_document_id);

create index if not exists reviewer_outputs_economy_reservation_key_idx
  on public.reviewer_outputs (user_id, economy_reservation_key);

create index if not exists reviewer_outputs_status_idx
  on public.reviewer_outputs (user_id, status, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can view their own reviewers'
  ) then
    create policy "Users can view their own reviewers"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'reviewers' and ((select auth.uid()) = owner));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can insert their own reviewers'
  ) then
    create policy "Users can insert their own reviewers"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'reviewers' and ((select auth.uid()) = owner));
  end if;
end $$;
