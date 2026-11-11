-- Keep the debit in the same exception/subtransaction boundary as the review.
-- Retain the signature for rolling deployments; entitlement is rechecked here.
create or replace function public.process_learning_review_with_heart(
  p_user_id uuid, p_learning_item_id uuid, p_request_id text,
  p_review_session_id uuid, p_state integer, p_due_at timestamptz,
  p_stability double precision, p_difficulty double precision,
  p_reps integer, p_lapses integer, p_rating integer, p_was_correct boolean,
  p_scheduled_days integer, p_previous_due_at timestamptz, p_consume_heart boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account public.economy_accounts%rowtype;
  v_heart_result jsonb;
  v_premium boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_user_id is null or nullif(trim(p_request_id), '') is null then
    raise exception 'Missing user or request id';
  end if;
  perform * from public.ensure_economy_account(p_user_id);
  select * into strict v_account from public.economy_accounts
  where user_id = p_user_id for update;

  if exists (select 1 from public.learning_reviews
    where user_id = p_user_id and request_id = p_request_id) then
    return jsonb_build_object('status', 'already_processed', 'idempotent', true,
      'hearts', v_account.hearts, 'heartCap', v_account.heart_cap, 'heartsDelta', 0);
  end if;

  select exists (select 1 from public.user_entitlements
    where user_id = p_user_id and tier in ('premium', 'pro')) into v_premium;

  begin
    if not v_premium and not p_was_correct then
      v_heart_result := public.consume_quiz_heart(p_user_id, 'quiz-wrong-answer:' || p_request_id);
    end if;
    perform public.process_learning_review(
      p_user_id, p_learning_item_id, p_request_id, p_review_session_id,
      p_state, p_due_at, p_stability, p_difficulty, p_reps, p_lapses,
      p_rating, p_was_correct, p_scheduled_days, p_previous_due_at
    );
  exception when unique_violation then
    -- PostgreSQL rolls back BOTH operations above before entering this handler.
    -- Only an actually persisted duplicate can be acknowledged as success.
    if not exists (select 1 from public.learning_reviews
      where user_id = p_user_id and request_id = p_request_id) then
      raise;
    end if;
    select * into strict v_account from public.economy_accounts where user_id = p_user_id;
    return jsonb_build_object('status', 'already_processed', 'idempotent', true,
      'hearts', v_account.hearts, 'heartCap', v_account.heart_cap, 'heartsDelta', 0);
  end;

  select * into strict v_account from public.economy_accounts where user_id = p_user_id;
  return jsonb_build_object('status', 'processed', 'idempotent', false,
    'hearts', v_account.hearts, 'heartCap', v_account.heart_cap,
    'heartsDelta', coalesce((v_heart_result->>'heartsDelta')::integer, 0));
end;
$$;

revoke execute on function public.process_learning_review_with_heart(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.process_learning_review_with_heart(uuid, uuid, text, uuid, integer, timestamptz, double precision, double precision, integer, integer, integer, boolean, integer, timestamptz, boolean) to service_role;
notify pgrst, 'reload schema';
