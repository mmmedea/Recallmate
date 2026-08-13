-- ========================================================================================
-- RECALLMATE — PHASE 6.4: BACKEND CONTRACT CORRECTIONS
-- ========================================================================================

-- 1. Enable Realtime for Documents and AI Jobs
-- Allows the client to subscribe to Postgres Changes for the Processing Workspace.
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.ai_jobs;

-- 2. Add Auto-Generate Preference
-- Ensures users can opt-out of automatic study material generation.
alter table public.preferences add column auto_generate boolean not null default true;

-- 3. Add Generation Version for Future Intentional Regeneration Identity
-- Allows the system to distinguish "retry the broken job" from "generate a brand new quiz".
alter table public.documents add column generation_version integer not null default 1;
alter table public.ai_jobs add column generation_version integer not null default 1;

-- 4. Transactional Upload Confirmation RPC
-- Guarantees atomicity: document finalization + job creation + idempotency key.
create or replace function public.confirm_document_upload(
    p_document_id uuid,
    p_user_id uuid,
    p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
