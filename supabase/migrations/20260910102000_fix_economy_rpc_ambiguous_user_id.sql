-- Fix ambiguous PL/pgSQL column references in the economy account bootstrap RPC.
--
-- Root cause:
-- ensure_economy_account() returns a table with an output column named user_id.
-- Inside PL/pgSQL that output column is also a variable, so unqualified conflict
-- targets such as ON CONFLICT (user_id) can be interpreted ambiguously at runtime.
-- This broke wallet snapshots and daily reward claims for authenticated users.

create or replace function public.ensure_economy_account(p_user_id uuid)
returns table (
  user_id uuid,
  coins integer,
  hearts integer,
  heart_cap integer,
  current_streak integer,
  longest_streak integer,
  restore_available_for date,
  restore_cost_coins integer,
  study_day date
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  insert into public.economy_accounts (user_id, coins, hearts, heart_cap)
  values (p_user_id, 1000, 15, 15)
  on conflict on constraint economy_accounts_pkey do nothing;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  values (p_user_id, 'new-user-grant', 'NEW_USER_GRANT', 1000, jsonb_build_object('source', 'signup'))
  on conflict on constraint economy_ledger_user_id_idempotency_key_key do nothing;

  return query
  select
    account.user_id,
    account.coins,
    account.hearts,
    account.heart_cap,
    account.current_streak,
    account.longest_streak,
    account.restore_available_for,
    200,
    public.recallmate_study_day()
  from public.economy_accounts as account
  where account.user_id = p_user_id;
end;
$$;

revoke execute on function public.ensure_economy_account(uuid) from public, anon, authenticated;
grant execute on function public.ensure_economy_account(uuid) to service_role;
