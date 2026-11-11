-- Restore the entitlement contract used by the authenticated application shell.
-- New free accounts receive the same 15-generation allowance shown in the UI.
ALTER TABLE public.user_entitlements
  ADD COLUMN IF NOT EXISTS credits_remaining integer NOT NULL DEFAULT 15
  CHECK (credits_remaining >= 0 AND credits_remaining <= 15);

COMMENT ON COLUMN public.user_entitlements.credits_remaining IS
  'Remaining free AI generations for the account; server-managed.';
