-- Phase 6.4.1: Realtime & Preferences Migration

-- 1. Enable Realtime replication for documents and ai_jobs
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.ai_jobs;

-- 2. Add auto_generate boolean to preferences
alter table public.preferences
add column auto_generate boolean default true not null;

-- 3. Replace the upload RPC to be fully transactional
create or replace function confirm_document_upload(
  p_document_id uuid,
  p_user_id uuid,
  p_idempotency_key text
) returns uuid as $$
declare
  v_job_id uuid;
begin
  -- 1. Update the document status atomically
  update public.documents
  set status = 'queued'
  where id = p_document_id and user_id = p_user_id;

  -- 2. Insert the initial extraction job atomically
  insert into public.ai_jobs (
    user_id,
    document_id,
    operation,
    status,
    idempotency_key,
    generation_version
  ) values (
    p_user_id,
    p_document_id,
    'extract_text',
    'queued',
    p_idempotency_key,
    1
  ) returning id into v_job_id;

  return v_job_id;
end;
$$ language plpgsql security definer;
