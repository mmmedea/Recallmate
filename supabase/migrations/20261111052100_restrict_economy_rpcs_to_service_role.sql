-- Keep economy mutations behind trusted server-side code.
-- The current application does not call these RPCs directly from clients.
REVOKE ALL ON FUNCTION public.claim_daily_reward(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_hearts(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_streak(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_hearts(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_streak(text) TO service_role;
