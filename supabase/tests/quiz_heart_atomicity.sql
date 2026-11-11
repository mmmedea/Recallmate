-- Rollback-only integration test. No real user rows or balances are changed.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);
do $$
declare
  u uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); q uuid := gen_random_uuid(); i uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
  result jsonb; frozen jsonb; failed boolean := false;
begin
  insert into auth.users(id, email, raw_user_meta_data)
    values (u, 'quiz-atomicity-' || u || '@example.invalid', '{}'::jsonb);
  insert into public.documents(id,user_id,filename,storage_path)
    values(d,u,'rollback-only-test.txt','rollback-only-test');
  insert into public.document_chunks(id,document_id,chunk_index,content)
    values(c,d,0,'Integration fixture');
  insert into public.questions(id,document_id,question_text,options,correct_answer,source_chunk_id)
    values(q,d,'Fixture question','["Right","Wrong"]'::jsonb,'0',c);
  insert into public.learning_items(id,user_id,document_id,question_id) values(i,u,d,q);
  frozen := public.freeze_quiz_session(u,d,array[q],'mixed','unseen');
  result := public.freeze_quiz_session(u,d,array[gen_random_uuid()],'mixed','unseen');
  if result->>'id' <> frozen->>'id' or result->'question_ids' <> frozen->'question_ids' then
    raise exception 'Active frozen session was not reused';
  end if;
  begin
    insert into public.quiz_sessions(user_id,document_id,mode,question_ids) values(u,d,'unseen',array[q]);
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'Active-session unique invariant missing'; end if;
  failed := false;
  insert into public.learning_review_sessions(id,user_id,document_id,quiz_session_id,question_ids)
    values(s1,u,d,(frozen->>'id')::uuid,array[q]),(s2,u,d,(frozen->>'id')::uuid,array[q]);
  perform * from public.ensure_economy_account(u);
  update public.economy_accounts set hearts=18 where user_id=u;

  result := public.process_learning_review_with_heart(u,i,'wrong-one',s1,1,now(),1,1,1,1,1,false,1,now(),true);
  if (result->>'hearts')::int <> 17 then raise exception 'Wrong answer did not debit exactly one'; end if;
  result := public.process_learning_review_with_heart(u,i,'wrong-one',null,1,now(),1,1,1,1,1,false,1,now(),true);
  if (result->>'hearts')::int <> 17 or result->>'status' <> 'already_processed' then
    raise exception 'Retry changed wallet';
  end if;
  result := public.process_learning_review_with_heart(u,i,'different-tab-request',s2,1,now(),1,1,1,1,1,false,1,now(),true);
  if (result->>'hearts')::int <> 17 or result->>'status' <> 'already_processed' then
    raise exception 'Second tab debited the same frozen attempt';
  end if;
  if not exists(select 1 from public.quiz_question_attempts where quiz_session_id=(frozen->>'id')::uuid and answered_at is not null and correct=false)
    or not exists(select 1 from public.quiz_sessions where id=(frozen->>'id')::uuid and status='completed') then
    raise exception 'Quiz attempt and session did not complete atomically';
  end if;
  perform public.process_learning_review_with_heart(u,i,'correct-one',null,1,now(),1,1,1,0,3,true,1,now(),true);
  perform public.process_learning_review_with_heart(u,i,'correct-one',null,1,now(),1,1,1,0,3,true,1,now(),true);
  if (select hearts from public.economy_accounts where user_id=u) <> 17 then
    raise exception 'Correct answer changed wallet';
  end if;

  -- Invalid FSRS rating fails after the debit, during review persistence.
  begin
    perform public.process_learning_review_with_heart(u,i,'forced-failure',null,1,now(),1,1,1,1,99,false,1,now(),true);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'Expected forced review failure'; end if;
  if (select hearts from public.economy_accounts where user_id=u) <> 17
    or exists(select 1 from public.economy_ledger where user_id=u and idempotency_key='quiz-wrong-answer:forced-failure') then
    raise exception 'Failed review leaked a debit';
  end if;

  update public.economy_accounts set hearts=1 where user_id=u;
  result := public.process_learning_review_with_heart(u,i,'last-heart',null,1,now(),1,1,1,1,1,false,1,now(),true);
  if (result->>'hearts')::int <> 0 or not exists(select 1 from public.learning_reviews where user_id=u and request_id='last-heart') then
    raise exception 'Final heart answer did not commit';
  end if;
  failed := false;
  begin
    perform public.process_learning_review_with_heart(u,i,'no-heart',null,1,now(),1,1,1,1,1,false,1,now(),true);
  exception when raise_exception then
    if sqlerrm <> 'No hearts remaining' then raise; end if;
    failed := true;
  end;
  if not failed then raise exception 'Zero-heart debit was allowed'; end if;
  if (select count(*) from public.economy_ledger where user_id=u and entry_type='QUIZ_WRONG_ANSWER') <> 2 then
    raise exception 'Unexpected debit count';
  end if;

  insert into public.user_entitlements(user_id,tier) values(u,'premium')
    on conflict(user_id) do update set tier='premium';
  result := public.process_learning_review_with_heart(u,i,'premium-zero',null,1,now(),1,1,1,1,1,false,1,now(),true);
  if (result->>'heartsDelta')::int <> 0 then raise exception 'Premium was debited'; end if;
  if (select count(*) from public.economy_ledger where user_id=u and entry_type='QUIZ_WRONG_ANSWER') <> 2 then
    raise exception 'Premium created debit ledger row';
  end if;
end;
$$;
rollback;
select 'PASS: frozen session reuse and unique invariant; wrong, duplicate, correct, rollback, final heart, zero rejection, premium; fixtures rolled back' as result;
