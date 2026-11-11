create or replace function public.claim_ai_job()
returns table (
  id uuid,
  user_id uuid,
  document_id uuid,
  operation text,
  idempotency_key text,
  status text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone
)
language plpgsql
security definer
as $$
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
