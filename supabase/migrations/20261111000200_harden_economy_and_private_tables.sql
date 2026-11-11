-- Harden authenticated economy RPCs and remove public table grants
-- from backend-only telemetry and support data.

CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_account public.economy_accounts%rowtype;
  v_today date := public.recallmate_study_day();
  v_gap integer;
  v_new_streak integer;
  v_reward_day integer;
  v_coins integer := 0;
  v_hearts integer := 0;
BEGIN
  IF COALESCE(v_claims->>'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'Authenticated account required' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;

  PERFORM * FROM public.ensure_economy_account(v_user_id);
  SELECT * INTO v_account
  FROM public.economy_accounts
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.economy_ledger
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('status', 'already_applied', 'coins', v_account.coins, 'hearts', v_account.hearts, 'streak', v_account.current_streak);
  END IF;

  IF v_account.last_claimed_day = v_today THEN
    RETURN jsonb_build_object('status', 'already_claimed_today', 'coins', v_account.coins, 'hearts', v_account.hearts, 'streak', v_account.current_streak);
  END IF;

  v_gap := CASE WHEN v_account.last_claimed_day IS NULL THEN NULL ELSE v_today - v_account.last_claimed_day END;

  IF v_gap = 2 THEN
    UPDATE public.economy_accounts
    SET restore_available_for = v_account.last_claimed_day + 1,
        updated_at = now()
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'status', 'restore_available',
      'restoreCostCoins', 200,
      'missedDay', v_account.last_claimed_day + 1,
      'coins', v_account.coins,
      'hearts', v_account.hearts,
      'streak', v_account.current_streak
    );
  END IF;

  IF v_gap IS NULL OR v_gap = 1 THEN
    v_new_streak := v_account.current_streak + 1;
  ELSIF v_gap >= 3 THEN
    v_new_streak := 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_reward_day := ((v_new_streak - 1) % 7) + 1;
  v_hearts := CASE v_reward_day WHEN 1 THEN 3 WHEN 3 THEN 5 WHEN 5 THEN 5 WHEN 6 THEN 6 ELSE 0 END;
  v_coins := CASE v_reward_day WHEN 2 THEN 500 WHEN 4 THEN 1000 WHEN 5 THEN 500 WHEN 7 THEN 2000 ELSE 0 END;

  INSERT INTO public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, hearts_delta, metadata)
  VALUES (v_user_id, p_idempotency_key, 'DAILY_REWARD', v_coins, v_hearts, jsonb_build_object('streak', v_new_streak, 'rewardDay', v_reward_day, 'studyDay', v_today));

  UPDATE public.economy_accounts
  SET coins = coins + v_coins,
      hearts = hearts + v_hearts,
      current_streak = v_new_streak,
      longest_streak = greatest(longest_streak, v_new_streak),
      last_claimed_day = v_today,
      restore_available_for = null,
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('status', 'claimed', 'coinsDelta', v_coins, 'heartsDelta', v_hearts, 'streak', v_new_streak, 'rewardDay', v_reward_day);
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_hearts(p_kind text, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_account public.economy_accounts%rowtype;
  v_cost integer;
  v_hearts_delta integer;
BEGIN
  IF COALESCE(v_claims->>'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'Authenticated account required' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;
  IF p_kind NOT IN ('add_five', 'refill_to_cap') THEN
    RAISE EXCEPTION 'Invalid heart purchase';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;

  PERFORM * FROM public.ensure_economy_account(v_user_id);
  SELECT * INTO v_account
  FROM public.economy_accounts
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.economy_ledger
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('status', 'already_applied', 'coins', v_account.coins, 'hearts', v_account.hearts);
  END IF;

  IF p_kind = 'add_five' THEN
    v_cost := 200;
    v_hearts_delta := 5;
  ELSE
    IF v_account.hearts >= v_account.heart_cap THEN
      RAISE EXCEPTION 'Heart refill is only available below the 15-heart cap';
    END IF;
    v_cost := 500;
    v_hearts_delta := v_account.heart_cap - v_account.hearts;
  END IF;

  IF v_account.coins < v_cost THEN
    RAISE EXCEPTION 'Not enough coins';
  END IF;

  INSERT INTO public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, hearts_delta, metadata)
  VALUES (v_user_id, p_idempotency_key, 'HEART_PURCHASE', -v_cost, v_hearts_delta, jsonb_build_object('kind', p_kind));

  UPDATE public.economy_accounts
  SET coins = coins - v_cost,
      hearts = hearts + v_hearts_delta,
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('status', 'purchased', 'coinsDelta', -v_cost, 'heartsDelta', v_hearts_delta);
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_streak(p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_account public.economy_accounts%rowtype;
  v_today date := public.recallmate_study_day();
BEGIN
  IF COALESCE(v_claims->>'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'Authenticated account required' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid idempotency key';
  END IF;

  PERFORM * FROM public.ensure_economy_account(v_user_id);
  SELECT * INTO v_account
  FROM public.economy_accounts
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.economy_ledger
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('status', 'already_applied', 'coins', v_account.coins, 'hearts', v_account.hearts, 'streak', v_account.current_streak);
  END IF;
  IF v_account.restore_available_for IS NULL THEN
    RAISE EXCEPTION 'No one-day streak restore is available';
  END IF;
  IF v_account.coins < 200 THEN
    RAISE EXCEPTION 'Not enough coins to restore streak';
  END IF;

  INSERT INTO public.economy_ledger (user_id, idempotency_key, entry_type, coins_delta, metadata)
  VALUES (v_user_id, p_idempotency_key, 'STREAK_RESTORE', -200, jsonb_build_object('missedDay', v_account.restore_available_for, 'studyDay', v_today));

  UPDATE public.economy_accounts
  SET coins = coins - 200,
      current_streak = current_streak + 1,
      longest_streak = greatest(longest_streak, current_streak + 1),
      last_claimed_day = v_today,
      restore_available_for = null,
      updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('status', 'restored', 'coinsDelta', -200, 'streak', v_account.current_streak + 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_daily_reward(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_hearts(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_streak(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_hearts(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_streak(text) TO authenticated, service_role;

-- These tables have no user-facing RLS policies and are backend-only.
REVOKE ALL ON TABLE public.ai_usage_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.anthropic_credential_health FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_submissions FROM anon, authenticated;
