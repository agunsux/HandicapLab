-- 2026-09-11 — Quota policy alignment (PRO hard/soft semantics)
--
-- Canonical policy (src/lib/providers/quotaPolicy.ts):
--   API-Football PRO : hard 7,500/day  | soft 6,000/day
--   OddsPapi         : hard   250/month | soft   200/month
--
-- quota_state.safe_limit is the PROVIDER HARD LIMIT (atomic stop).
-- Soft-limit priority rationing (ECONOMY/CRITICAL) is enforced in the
-- application layer by QuotaManager V4 / providerGateway.
--
-- This migration rewrites any pre-existing rows created with the old
-- safety-reserve semantics (safe_limit = limit * (100 - reserve) / 100) so the
-- hard limit is respected exactly. It is idempotent and safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quota_state'
  ) THEN
    UPDATE public.quota_state
    SET safety_reserve_pct = 0,
        safe_limit = limit_value,
        updated_at = NOW()
    WHERE safety_reserve_pct <> 0
       OR safe_limit <> limit_value;
  END IF;
END
$$;

-- Refresh PostgREST schema cache so the reserve/confirm/rollback RPCs are
-- discoverable immediately after applying this migration.
NOTIFY pgrst, 'reload schema';
