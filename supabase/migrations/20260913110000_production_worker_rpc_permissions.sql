-- Verified against the actual RecallMate project, not the similarly named project.
begin;

create or replace function public.claim_ai_job()
returns table(id uuid,user_id uuid,document_id uuid,operation text,idempotency_key text,
  status text,started_at timestamptz,completed_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_job_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  update public.ai_jobs aj set status='processing',started_at=now()
  where aj.id=(select queued.id from public.ai_jobs queued
    where queued.status='queued' order by queued.created_at
    for update skip locked limit 1)
  returning aj.id into v_job_id;
  -- Explicit projection remains compatible when ai_jobs gains columns.
  return query select aj.id,aj.user_id,aj.document_id,aj.operation,aj.idempotency_key,
    aj.status,aj.started_at,aj.completed_at,aj.created_at
    from public.ai_jobs aj where aj.id=v_job_id;
end;
$$;

revoke execute on function public.claim_ai_job() from public,anon,authenticated;
grant execute on function public.claim_ai_job() to service_role;
revoke execute on function public.confirm_document_upload(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_document_upload(uuid,uuid,text) to service_role;

-- Retrieval is intentionally available to signed-in callers under existing RLS.
alter function public.search_document_chunks(text,uuid[],uuid,integer) set search_path='';
revoke execute on function public.search_document_chunks(text,uuid[],uuid,integer) from public,anon;
grant execute on function public.search_document_chunks(text,uuid[],uuid,integer) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
