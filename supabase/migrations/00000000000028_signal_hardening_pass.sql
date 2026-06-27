-- Migration: Signal Integrity Hardening Pass
-- Sequence number: 00000000000028

-- 1. Ensure new tracing columns exist on signal_audit_events (non-destructive)
ALTER TABLE public.signal_audit_events ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.signal_audit_events ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- 2. Ensure locked_at exists on signals (non-destructive)
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Create index for correlation_id lookups
CREATE INDEX IF NOT EXISTS idx_signal_audit_events_correlation_id ON public.signal_audit_events(correlation_id);

-- 3. Define trigger to prevent updates to prediction fields on kickoff or lock
CREATE OR REPLACE FUNCTION public.prevent_prediction_updates_on_locked()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-lock if kickoff time has passed and not already locked
  IF NEW.kickoff_utc <= NOW() AND NEW.locked_at IS NULL THEN
    NEW.locked_at := NOW();
  END IF;

  -- Block prediction edits after kickoff or explicit lock
  IF OLD.locked_at IS NOT NULL OR (OLD.kickoff_utc <= NOW() AND TG_OP = 'UPDATE') THEN
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := NOW();
    END IF;

    -- Compare prediction-definition fields. Mutations are strictly blocked.
    IF NEW.odds IS DISTINCT FROM OLD.odds OR
       NEW.handicap_line IS DISTINCT FROM OLD.handicap_line OR
       NEW.selection IS DISTINCT FROM OLD.selection OR
       NEW.fair_odds IS DISTINCT FROM OLD.fair_odds OR
       NEW.probability IS DISTINCT FROM OLD.probability OR
       NEW.edge_pct IS DISTINCT FROM OLD.edge_pct OR
       NEW.confidence IS DISTINCT FROM OLD.confidence THEN
      RAISE EXCEPTION 'Signal is locked. Prediction fields cannot be mutated.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_prediction_updates_on_locked ON public.signals;
CREATE TRIGGER trg_prevent_prediction_updates_on_locked
BEFORE UPDATE ON public.signals
FOR EACH ROW EXECUTE FUNCTION public.prevent_prediction_updates_on_locked();
