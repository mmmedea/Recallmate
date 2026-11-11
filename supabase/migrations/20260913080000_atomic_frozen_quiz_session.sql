-- Refuse duplicate active sessions even if a caller bypasses the RPC.
create unique index if not exists quiz_sessions_one_active_scope
  on public.quiz_sessions(user_id, document_id, mode) where status = 'in_progress';

create or replace function public.freeze_quiz_session(
  p_user_id uuid, p_document_id uuid, p_question_ids uuid[],
  p_difficulty text default 'mixed', p_mode text default 'unseen'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session public.quiz_sessions%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if not exists(select 1 from public.documents where id=p_document_id and user_id=p_user_id) then
    raise exception 'Document not found or unauthorized' using errcode = '42501';
  end if;
  if p_mode is null then raise exception 'Missing mode'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_document_id::text || ':' || p_mode, 0));
  select * into v_session from public.quiz_sessions
    where user_id=p_user_id and document_id=p_document_id and mode=p_mode and status='in_progress';
  if found then
    return jsonb_build_object('id',v_session.id,'question_ids',v_session.question_ids,'reused',true);
  end if;
  if coalesce(cardinality(p_question_ids),0) = 0 or cardinality(p_question_ids)>50 then
    raise exception 'Invalid question count';
  end if;
  if (select count(distinct id) from unnest(p_question_ids) id) <> cardinality(p_question_ids)
    or (select count(*) from public.questions where id=any(p_question_ids) and document_id=p_document_id and status='approved') <> cardinality(p_question_ids) then
    raise exception 'Invalid source questions';
  end if;
  if p_mode='unseen' and exists(select 1 from public.quiz_question_attempts a
    join public.questions q on q.id=any(p_question_ids)
    where a.user_id=p_user_id and (a.question_id=q.id or a.question_bank_id=q.question_bank_id)) then
    raise exception 'Question selection changed; retry' using errcode = '40001';
  end if;
  insert into public.quiz_sessions(user_id,document_id,mode,difficulty,question_ids)
    values(p_user_id,p_document_id,p_mode,p_difficulty,p_question_ids) returning * into v_session;
  insert into public.quiz_question_attempts(user_id,question_id,question_bank_id,quiz_session_id,attempt_number)
    select p_user_id,q.id,q.question_bank_id,v_session.id,ids.position::integer
    from unnest(p_question_ids) with ordinality as ids(id,position) join public.questions q on q.id=ids.id;
  return jsonb_build_object('id',v_session.id,'question_ids',v_session.question_ids,'reused',false);
end;
$$;
revoke execute on function public.freeze_quiz_session(uuid,uuid,uuid[],text,text) from public, anon, authenticated;
grant execute on function public.freeze_quiz_session(uuid,uuid,uuid[],text,text) to service_role;
notify pgrst, 'reload schema';
