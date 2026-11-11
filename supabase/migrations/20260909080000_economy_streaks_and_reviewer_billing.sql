-- RecallMate server-authoritative economy, daily streaks, and Reviewer Maker billing.

create table if not exists public.economy_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 1000 check (coins >= 0),
  hearts integer not null default 15 check (hearts >= 0),
  heart_cap integer not null default 15 check (heart_cap = 15),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_claimed_day date,
  restore_available_for date,
  new_user_granted_at timestamptz not null default now(),
  premium_bonus_granted_at timestamptz,
  last_heart_regen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economy_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  entry_type text not null check (
    entry_type in (
      'NEW_USER_GRANT',
      'PREMIUM_GRANT',
      'DAILY_REWARD',
      'STREAK_RESTORE',
      'HEART_PURCHASE',
      'REVIEWER_RESERVATION',
      'REVIEWER_CHARGE',
      'REVIEWER_REFUND',
      'ADJUSTMENT'
    )
  ),
  coins_delta integer not null default 0,
  hearts_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table if exists public.reviewer_outputs
  add column if not exists economy_reservation_key text,
  add column if not exists coin_cost integer not null default 0 check (coin_cost >= 0),
  add column if not exists refunded_at timestamptz;

create index if not exists economy_ledger_user_created_idx on public.economy_ledger(user_id, created_at desc);
do $$
begin
  if to_regclass('public.reviewer_outputs') is not null then
    create index if not exists reviewer_outputs_economy_reservation_key_idx on public.reviewer_outputs(user_id, economy_reservation_key);
  end if;
end;
$$;

alter table public.economy_accounts enable row level security;
alter table public.economy_ledger enable row level security;

drop policy if exists "Users can view own economy account" on public.economy_accounts;
create policy "Users can view own economy account"
on public.economy_accounts for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own economy ledger" on public.economy_ledger;
create policy "Users can view own economy ledger"
on public.economy_ledger for select to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.economy_accounts to authenticated;
grant select on table public.economy_ledger to authenticated;
grant all on table public.economy_accounts to service_role;
grant all on table public.economy_ledger to service_role;

create or replace function public.recallmate_study_day(p_now timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select (((p_now at time zone 'Asia/Manila') - interval '8 hours')::date);
$$;

create or replace function public.reviewer_coin_cost(p_file_size_bytes bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_mb numeric := greatest(p_file_size_bytes, 0)::numeric / (1024 * 1024);
begin
  if v_mb <= 5 then return 500; end if;
  if v_mb <= 15 then return 650; end if;
  if v_mb <= 30 then return 800; end if;
  if v_mb <= 50 then return 1000; end if;
  raise exception 'Reviewer Maker supports files up to 50MB.';
end;
$$;

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
  on conflict (user_id) do nothing;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  values (p_user_id, 'new-user-grant', 'NEW_USER_GRANT', 1000, jsonb_build_object('source', 'signup'))
  on conflict (user_id, idempotency_key) do nothing;

  return query
  select
    a.user_id,
    a.coins,
    a.hearts,
    a.heart_cap,
    a.current_streak,
    a.longest_streak,
    a.restore_available_for,
    200,
    public.recallmate_study_day()
  from public.economy_accounts a
  where a.user_id = p_user_id;
end;
$$;

create or replace function public.claim_daily_reward(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.economy_accounts%rowtype;
  v_today date := public.recallmate_study_day();
  v_gap integer;
  v_new_streak integer;
  v_reward_day integer;
  v_coins integer := 0;
  v_hearts integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Missing idempotency key'; end if;

  perform * from public.ensure_economy_account(v_user_id);
  select * into v_account from public.economy_accounts where user_id = v_user_id for update;

  if exists (select 1 from public.economy_ledger where user_id = v_user_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('status', 'already_applied', 'coins', v_account.coins, 'hearts', v_account.hearts, 'streak', v_account.current_streak);
  end if;

  if v_account.last_claimed_day = v_today then
    return jsonb_build_object('status', 'already_claimed_today', 'coins', v_account.coins, 'hearts', v_account.hearts, 'streak', v_account.current_streak);
  end if;

  v_gap := case when v_account.last_claimed_day is null then null else v_today - v_account.last_claimed_day end;

  if v_gap = 2 then
    update public.economy_accounts
    set restore_available_for = v_account.last_claimed_day + 1,
        updated_at = now()
    where user_id = v_user_id;

    return jsonb_build_object(
      'status', 'restore_available',
      'restoreCostCoins', 200,
      'missedDay', v_account.last_claimed_day + 1,
      'coins', v_account.coins,
      'hearts', v_account.hearts,
      'streak', v_account.current_streak
    );
  end if;

  if v_gap is null or v_gap = 1 then
    v_new_streak := v_account.current_streak + 1;
  elsif v_gap >= 3 then
    v_new_streak := 1;
  else
    v_new_streak := 1;
  end if;

  v_reward_day := ((v_new_streak - 1) % 7) + 1;
  v_hearts := case v_reward_day when 1 then 3 when 3 then 5 when 5 then 5 when 6 then 6 else 0 end;
  v_coins := case v_reward_day when 2 then 500 when 4 then 1000 when 5 then 500 when 7 then 2000 else 0 end;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, hearts_delta, metadata)
  values (v_user_id, p_idempotency_key, 'DAILY_REWARD', v_coins, v_hearts, jsonb_build_object('streak', v_new_streak, 'rewardDay', v_reward_day, 'studyDay', v_today));

  update public.economy_accounts
  set coins = coins + v_coins,
      hearts = hearts + v_hearts,
      current_streak = v_new_streak,
      longest_streak = greatest(longest_streak, v_new_streak),
      last_claimed_day = v_today,
      restore_available_for = null,
      updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object('status', 'claimed', 'coinsDelta', v_coins, 'heartsDelta', v_hearts, 'streak', v_new_streak, 'rewardDay', v_reward_day);
end;
$$;

create or replace function public.restore_streak(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.economy_accounts%rowtype;
  v_today date := public.recallmate_study_day();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Missing idempotency key'; end if;

  perform * from public.ensure_economy_account(v_user_id);
  select * into v_account from public.economy_accounts where user_id = v_user_id for update;

  if exists (select 1 from public.economy_ledger where user_id = v_user_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('status', 'already_applied', 'coins', v_account.coins, 'hearts', v_account.hearts, 'streak', v_account.current_streak);
  end if;
  if v_account.restore_available_for is null then raise exception 'No one-day streak restore is available'; end if;
  if v_account.coins < 200 then raise exception 'Not enough coins to restore streak'; end if;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  values (v_user_id, p_idempotency_key, 'STREAK_RESTORE', -200, jsonb_build_object('missedDay', v_account.restore_available_for, 'studyDay', v_today));

  update public.economy_accounts
  set coins = coins - 200,
      current_streak = current_streak + 1,
      longest_streak = greatest(longest_streak, current_streak + 1),
      last_claimed_day = v_today,
      restore_available_for = null,
      updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object('status', 'restored', 'coinsDelta', -200, 'streak', v_account.current_streak + 1);
end;
$$;

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

create or replace function public.grant_premium_bonus(p_user_id uuid, p_idempotency_key text default 'premium-first-activation')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.economy_accounts%rowtype;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  perform * from public.ensure_economy_account(p_user_id);
  select * into v_account from public.economy_accounts where user_id = p_user_id for update;

  if v_account.premium_bonus_granted_at is not null then
    return jsonb_build_object('status', 'already_granted', 'coins', v_account.coins);
  end if;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  values (p_user_id, p_idempotency_key, 'PREMIUM_GRANT', 5000, jsonb_build_object('source', 'premium_activation'))
  on conflict (user_id, idempotency_key) do nothing;

  update public.economy_accounts
  set coins = coins + 5000,
      premium_bonus_granted_at = now(),
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object('status', 'granted', 'coinsDelta', 5000);
end;
$$;

create or replace function public.reserve_reviewer_generation(
  p_user_id uuid,
  p_file_size_bytes bigint,
  p_idempotency_key text,
  p_document_ids uuid[] default array[]::uuid[],
  p_format text default 'docx'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.economy_accounts%rowtype;
  v_cost integer := public.reviewer_coin_cost(p_file_size_bytes);
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if p_format not in ('pdf', 'docx') then raise exception 'Invalid reviewer format'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Missing idempotency key'; end if;
  if exists (
    select 1
    from unnest(p_document_ids) as requested(id)
    left join public.documents d on d.id = requested.id and d.user_id = p_user_id
    where d.id is null
  ) then
    raise exception 'One or more reviewer documents are not owned by this user';
  end if;

  perform * from public.ensure_economy_account(p_user_id);
  select * into v_account from public.economy_accounts where user_id = p_user_id for update;

  if exists (select 1 from public.economy_ledger where user_id = p_user_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('status', 'already_reserved', 'cost', v_cost, 'coins', v_account.coins);
  end if;
  if v_account.coins < v_cost then raise exception 'Insufficient coins. Required: %, Available: %', v_cost, v_account.coins; end if;

  insert into public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  values (
    p_user_id,
    p_idempotency_key,
    'REVIEWER_RESERVATION',
    -v_cost,
    jsonb_build_object('fileSizeBytes', p_file_size_bytes, 'documentIds', p_document_ids, 'format', p_format)
  );

  update public.economy_accounts
  set coins = coins - v_cost,
      updated_at = now()
  where user_id = p_user_id;

  return jsonb_build_object('status', 'reserved', 'cost', v_cost, 'coins', v_account.coins - v_cost);
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
  if exists (
    select 1
    from public.economy_ledger
    where user_id = p_user_id
      and entry_type in ('REVIEWER_CHARGE', 'REVIEWER_REFUND')
      and metadata->>'reservationKey' = p_reservation_key
  ) then
    return jsonb_build_object('status', 'already_finalized');
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

revoke execute on function public.recallmate_study_day(timestamptz) from public, anon, authenticated;
revoke execute on function public.reviewer_coin_cost(bigint) from public, anon, authenticated;
revoke execute on function public.ensure_economy_account(uuid) from public, anon, authenticated;
revoke execute on function public.grant_premium_bonus(uuid, text) from public, anon, authenticated;
revoke execute on function public.reserve_reviewer_generation(uuid, bigint, text, uuid[], text) from public, anon, authenticated;
revoke execute on function public.finalize_reviewer_generation(uuid, text, boolean, text) from public, anon, authenticated;

grant execute on function public.claim_daily_reward(text) to authenticated;
grant execute on function public.restore_streak(text) to authenticated;
grant execute on function public.purchase_hearts(text, text) to authenticated;
grant execute on function public.ensure_economy_account(uuid) to service_role;
grant execute on function public.grant_premium_bonus(uuid, text) to service_role;
grant execute on function public.reserve_reviewer_generation(uuid, bigint, text, uuid[], text) to service_role;
grant execute on function public.finalize_reviewer_generation(uuid, text, boolean, text) to service_role;

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
