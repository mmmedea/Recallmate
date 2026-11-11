-- Charge one heart for a wrong quiz answer in the server-authoritative economy.
-- The ledger key is unique per user, so retries and double-clicks are harmless.

alter table public.economy_ledger
  drop constraint if exists economy_ledger_entry_type_check;

alter table public.economy_ledger
  add constraint economy_ledger_entry_type_check check (
    entry_type in (
      'NEW_USER_GRANT',
      'PREMIUM_GRANT',
      'DAILY_REWARD',
      'STREAK_RESTORE',
      'HEART_PURCHASE',
      'QUIZ_WRONG_ANSWER',
      'REVIEWER_RESERVATION',
      'REVIEWER_CHARGE',
      'REVIEWER_REFUND',
      'ADJUSTMENT'
    )
  );

create or replace function public.consume_quiz_heart(
  p_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.economy_accounts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Missing idempotency key'; end if;

  perform * from public.ensure_economy_account(p_user_id);
  select * into v_account
  from public.economy_accounts
  where user_id = p_user_id
  for update;

  if exists (
    select 1
    from public.economy_ledger
    where user_id = p_user_id
      and idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'status', 'already_applied',
      'hearts', v_account.hearts,
      'heartCap', v_account.heart_cap,
      'heartsDelta', 0
    );
  end if;

  if v_account.hearts <= 0 then
    raise exception 'No hearts remaining' using errcode = 'P0001';
  end if;

  insert into public.economy_ledger (
    user_id,
    idempotency_key,
    entry_type,
    hearts_delta,
    metadata
  ) values (
    p_user_id,
    p_idempotency_key,
    'QUIZ_WRONG_ANSWER',
    -1,
    jsonb_build_object('source', 'quiz')
  ) on conflict (user_id, idempotency_key) do nothing;

  if not found then
    return jsonb_build_object(
      'status', 'already_applied',
      'hearts', v_account.hearts,
      'heartCap', v_account.heart_cap,
      'heartsDelta', 0
    );
  end if;

  update public.economy_accounts
  set hearts = hearts - 1,
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object(
    'status', 'deducted',
    'hearts', v_account.hearts - 1,
    'heartCap', v_account.heart_cap,
    'heartsDelta', -1
  );
end;
$$;

-- This wrapper keeps the learning transition and the heart debit in one
-- database transaction. If either operation fails, neither one commits.
create or replace function public.process_learning_review_with_heart(
  p_user_id uuid,
  p_learning_item_id uuid,
  p_request_id text,
  p_review_session_id uuid,
  p_state integer,
  p_due_at timestamptz,
  p_stability double precision,
  p_difficulty double precision,
  p_reps integer,
  p_lapses integer,
  p_rating integer,
  p_was_correct boolean,
  p_scheduled_days integer,
  p_previous_due_at timestamptz,
  p_consume_heart boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.economy_accounts%rowtype;
  v_heart_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if nullif(trim(p_request_id), '') is null then raise exception 'Missing request id'; end if;

  perform * from public.ensure_economy_account(p_user_id);
  select * into v_account
  from public.economy_accounts
  where user_id = p_user_id
  for update;

  -- A prior deployment may have persisted the review before this economy
  -- migration existed. Never charge that historical retry retroactively.
  if exists (
    select 1
    from public.learning_reviews
    where user_id = p_user_id
      and request_id = p_request_id
  ) then
    return jsonb_build_object(
      'status', 'already_processed',
      'idempotent', true,
      'hearts', v_account.hearts,
      'heartCap', v_account.heart_cap,
      'heartsDelta', 0
    );
  end if;

  if p_consume_heart and not p_was_correct then
    v_heart_result := public.consume_quiz_heart(
      p_user_id,
      'quiz-wrong-answer:' || p_request_id
    );
  else
    v_heart_result := jsonb_build_object(
      'status', 'not_charged',
      'hearts', v_account.hearts,
      'heartCap', v_account.heart_cap,
      'heartsDelta', 0
    );
  end if;

  begin
    perform public.process_learning_review(
      p_user_id,
      p_learning_item_id,
      p_request_id,
      p_review_session_id,
      p_state,
      p_due_at,
      p_stability,
      p_difficulty,
      p_reps,
      p_lapses,
      p_rating,
      p_was_correct,
      p_scheduled_days,
      p_previous_due_at
    );
  exception when unique_violation then
    if exists (
      select 1
      from public.learning_reviews
      where user_id = p_user_id
        and request_id = p_request_id
    ) then
      select * into v_account
      from public.economy_accounts
      where user_id = p_user_id;
      return jsonb_build_object(
        'status', 'already_processed',
        'idempotent', true,
        'hearts', v_account.hearts,
        'heartCap', v_account.heart_cap,
        'heartsDelta', 0
      );
    end if;
    raise;
  end;

  select * into v_account
  from public.economy_accounts
  where user_id = p_user_id;

  return jsonb_build_object(
    'status', 'processed',
    'idempotent', false,
    'hearts', v_account.hearts,
    'heartCap', v_account.heart_cap,
    'heartsDelta', coalesce((v_heart_result->>'heartsDelta')::integer, 0)
  );
end;
$$;

revoke execute on function public.consume_quiz_heart(uuid, text) from public, anon, authenticated;
revoke execute on function public.process_learning_review_with_heart(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.consume_quiz_heart(uuid, text) to service_role;
grant execute on function public.process_learning_review_with_heart(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz, boolean) to service_role;

notify pgrst, 'reload schema';
