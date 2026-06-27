-- Migration: Final Verification Gate Hardening
-- Sequence number: 00000000000029

-- 1. Ensure correlation_id exists on odds_history and prediction_results
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.prediction_results ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- 2. Create index on prediction_results correlation_id
CREATE INDEX IF NOT EXISTS idx_prediction_results_correlation_id ON public.prediction_results(correlation_id);

-- 3. Update trigger to support auto-logging of SIGNAL_LOCKED audit event
CREATE OR REPLACE FUNCTION public.prevent_prediction_updates_on_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id UUID;
BEGIN
  -- Auto-lock if kickoff time has passed and not already locked
  IF NEW.kickoff_utc <= NOW() AND NEW.locked_at IS NULL THEN
    NEW.locked_at := NOW();
  END IF;

  -- Trigger SIGNAL_LOCKED event if locked_at transitioned from NULL -> NOT NULL
  IF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL THEN
    -- Look up the correlation_id from the original SIGNAL_CREATED event
    SELECT correlation_id INTO v_correlation_id
    FROM public.signal_audit_events
    WHERE signal_id = NEW.id AND event_type = 'SIGNAL_CREATED'
    LIMIT 1;

    INSERT INTO public.signal_audit_events (signal_id, event_type, source, correlation_id, payload)
    VALUES (
      NEW.id,
      'SIGNAL_LOCKED',
      'system',
      COALESCE(v_correlation_id, NEW.id),
      jsonb_build_object(
        'signal_id', NEW.id,
        'locked_at', NEW.locked_at,
        'reason', CASE WHEN NEW.kickoff_utc <= NOW() THEN 'MATCH_STARTED' ELSE 'MANUAL_LOCK' END
      )
    );
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
