-- Harden economy acceptance edges after the initial server-authoritative economy rollout.

create or replace function public.purchase_hearts(p_kind text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.economy_accounts%rowtype;
  v_cost integer;
  v_hearts_delta integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_kind not in ('add_five', 'refill_to_cap') then raise exception 'Invalid heart purchase'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Missing idempotency key'; end if;

  perform * from public.ensure_economy_account(v_user_id);
  select * into v_account from public.economy_accounts where user_id = v_user_id for update;

  if exists (select 1 from public.economy_ledger where user_id = v_user_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('status', 'already_applied', 'coins', v_account.coins, 'hearts', v_account.hearts);
  end if;

  if p_kind = 'add_five' then
    v_cost := 200;
    v_hearts_delta := 5;
  else
    if v_account.hearts >= v_account.heart_cap then
      raise exception 'Heart refill is only available below the 15-heart cap';
    end if;
    v_cost := 500;
    v_hearts_delta := v_account.heart_cap - v_account.hearts;
  end if;

  if v_account.coins < v_cost then raise exception 'Not enough coins'; end if;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, hearts_delta, metadata)
  values (v_user_id, p_idempotency_key, 'HEART_PURCHASE', -v_cost, v_hearts_delta, jsonb_build_object('kind', p_kind));

  update public.economy_accounts
  set coins = coins - v_cost,
      hearts = hearts + v_hearts_delta,
      updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object('status', 'purchased', 'coinsDelta', -v_cost, 'heartsDelta', v_hearts_delta);
end;
$$;

create or replace function public.finalize_reviewer_generation(
  p_user_id uuid,
  p_reservation_key text,
  p_success boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.economy_ledger%rowtype;
  v_existing public.economy_ledger%rowtype;
  v_refund integer;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if nullif(trim(p_reservation_key), '') is null then raise exception 'Missing reservation key'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Missing idempotency key'; end if;

  select * into v_reservation
  from public.economy_ledger
  where user_id = p_user_id
    and idempotency_key = p_reservation_key
    and entry_type = 'REVIEWER_RESERVATION'
  for share;

  if not found then raise exception 'Reviewer reservation not found'; end if;

  select * into v_existing
  from public.economy_ledger
  where user_id = p_user_id
    and entry_type in ('REVIEWER_CHARGE', 'REVIEWER_REFUND')
    and metadata->>'reservationKey' = p_reservation_key
  order by created_at asc
  limit 1;

  if found then
    return jsonb_build_object('status', 'already_finalized', 'finalEntryType', v_existing.entry_type);
  end if;

  if exists (select 1 from public.economy_ledger where user_id = p_user_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('status', 'already_finalized');
  end if;

  if p_success then
    insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
    values (p_user_id, p_idempotency_key, 'REVIEWER_CHARGE', 0, jsonb_build_object('reservationKey', p_reservation_key));
    return jsonb_build_object('status', 'charged', 'refund', 0);
  end if;

  v_refund := abs(v_reservation.coins_delta);
  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  values (p_user_id, p_idempotency_key, 'REVIEWER_REFUND', v_refund, jsonb_build_object('reservationKey', p_reservation_key));

  update public.economy_accounts
  set coins = coins + v_refund,
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object('status', 'refunded', 'refund', v_refund);
end;
$$;

create or replace function public.grant_premium_bonus_from_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tier in ('premium', 'pro') and (tg_op = 'INSERT' or old.tier is distinct from new.tier) then
    perform public.grant_premium_bonus(new.user_id, 'premium-first-activation');
  end if;

  return new;
end;
$$;

drop trigger if exists grant_premium_bonus_from_entitlement_trigger on public.user_entitlements;
create trigger grant_premium_bonus_from_entitlement_trigger
after insert or update of tier on public.user_entitlements
for each row
execute function public.grant_premium_bonus_from_entitlement();

revoke execute on function public.grant_premium_bonus_from_entitlement() from public, anon, authenticated;
grant execute on function public.purchase_hearts(text, text) to authenticated;
grant execute on function public.finalize_reviewer_generation(uuid, text, boolean, text) to service_role;

