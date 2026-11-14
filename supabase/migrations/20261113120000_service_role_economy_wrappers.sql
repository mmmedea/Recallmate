-- Server-only wrappers for economy mutations after RPC access was restricted.
-- The caller must authenticate the end user first, then invoke these wrappers
-- with the service-role client and the verified user ID.
create or replace function public.service_claim_daily_reward(
  p_user_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'User id required';
  end if;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id,
    'role', 'authenticated',
    'is_anonymous', false
  )::text, true);
  return public.claim_daily_reward(p_idempotency_key);
end;
$function$;

create or replace function public.service_restore_streak(
  p_user_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'User id required';
  end if;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id,
    'role', 'authenticated',
    'is_anonymous', false
  )::text, true);
  return public.restore_streak(p_idempotency_key);
end;
$function$;

create or replace function public.service_purchase_hearts(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'User id required';
  end if;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id,
    'role', 'authenticated',
    'is_anonymous', false
  )::text, true);
  return public.purchase_hearts(p_kind, p_idempotency_key);
end;
$function$;

revoke all on function public.service_claim_daily_reward(uuid, text) from public, anon, authenticated;
revoke all on function public.service_restore_streak(uuid, text) from public, anon, authenticated;
revoke all on function public.service_purchase_hearts(uuid, text, text) from public, anon, authenticated;
grant execute on function public.service_claim_daily_reward(uuid, text) to service_role;
grant execute on function public.service_restore_streak(uuid, text) to service_role;
grant execute on function public.service_purchase_hearts(uuid, text, text) to service_role;
