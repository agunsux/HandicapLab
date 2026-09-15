-- P0.3 — Controlled API-Football Egress: event queue atomicity
-- Location: supabase/migrations/20260914000000_controlled_egress_queue.sql
--
-- Additive, non-destructive. Extends the existing EPIC 54 `event_queue` with the
-- primitives required for a single controlled ingestion worker:
--   * deterministic `event_key` (idempotent enqueue)
--   * `lease_expires_at` (crash-safe processing leases)
--   * atomic claim RPC using FOR UPDATE SKIP LOCKED
--   * stale-lease recovery RPC
--   * an idempotent enqueue RPC
--   * a worker heartbeat table
--
-- No existing queue rows are deleted or rewritten.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns (nullable for backward compatibility with existing rows)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_queue
  ADD COLUMN IF NOT EXISTS event_key TEXT;

ALTER TABLE public.event_queue
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_queue.event_key IS
  'Deterministic idempotency key. At most one pending/processing event may share a key.';
COMMENT ON COLUMN public.event_queue.lease_expires_at IS
  'When a worker claimed the event; if now() passes this while processing, the lease is recovered.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Idempotency: only one ACTIVE (pending/processing) event per event_key.
--    Completed/failed rows do not block future enqueues with the same key.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_queue_event_key_active
  ON public.event_queue (event_key)
  WHERE event_key IS NOT NULL AND status IN ('pending', 'processing');

-- Claim path index
CREATE INDEX IF NOT EXISTS idx_event_queue_claim
  ON public.event_queue (status, priority, scheduled_for)
  WHERE status = 'pending';

-- Stale lease recovery index
CREATE INDEX IF NOT EXISTS idx_event_queue_lease
  ON public.event_queue (lease_expires_at)
  WHERE status = 'processing';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Idempotent enqueue RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_event(
  p_event_type TEXT,
  p_fixture_id TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL,
  p_priority INTEGER DEFAULT 50,
  p_event_key TEXT DEFAULT NULL,
  p_scheduled_for TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.event_queue (
    event_type, fixture_id, payload, priority, status, scheduled_for, event_key
  )
  VALUES (
    p_event_type, p_fixture_id, p_payload, p_priority, 'pending',
    COALESCE(p_scheduled_for, now()), p_event_key
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  -- Duplicate active job for this key: return the existing one.
  IF v_id IS NULL AND p_event_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.event_queue
    WHERE event_key = p_event_key
      AND status IN ('pending', 'processing')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_event(TEXT, TEXT, JSONB, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Atomic claim RPC (FOR UPDATE SKIP LOCKED) — never hand the same event to
--    two workers. Callers filter by event type list.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_next_event(
  p_event_types TEXT[] DEFAULT NULL,
  p_lock_seconds INTEGER DEFAULT 300
)
RETURNS SETOF public.event_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_queue;
BEGIN
  SELECT *
  INTO v_row
  FROM public.event_queue
  WHERE status = 'pending'
    AND scheduled_for <= now()
    AND (p_event_types IS NULL OR event_type = ANY (p_event_types))
  ORDER BY priority ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.event_queue
  SET status = 'processing',
      started_at = now(),
      lease_expires_at = now() + make_interval(secs => GREATEST(p_lock_seconds, 30))
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN NEXT v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_event(TEXT[], INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Stale lease recovery — return expired processing events to pending.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recover_expired_event_leases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.event_queue
  SET status = 'pending',
      started_at = NULL,
      lease_expires_at = NULL,
      last_error = COALESCE(last_error, 'RECOVERED: expired worker lease')
  WHERE status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recover_expired_event_leases() TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Worker heartbeat (health/status without a public inbound endpoint)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_worker_health (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAUSED', 'DEGRADED', 'STOPPED')),
  observed_egress_ip TEXT,
  expected_egress_ip TEXT,
  queue_pending INTEGER NOT NULL DEFAULT 0,
  queue_processing INTEGER NOT NULL DEFAULT 0,
  queue_failed INTEGER NOT NULL DEFAULT 0,
  provider_state TEXT,
  quota_mode TEXT,
  last_job_id TEXT,
  last_job_type TEXT,
  last_job_status TEXT,
  last_error TEXT,
  version TEXT,
  concurrency INTEGER,
  started_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.provider_worker_health IS
  'Heartbeat/status for the controlled API-Football egress worker. Read by authenticated ops routes.';

ALTER TABLE public.provider_worker_health ENABLE ROW LEVEL SECURITY;

-- No public policy: only the service role (used by the worker and ops routes) writes/reads.
