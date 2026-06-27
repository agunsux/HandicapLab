-- Migration: Settlement Immutability & Admin Corrections
-- Sequence number: 00000000000030

-- 1. Ensure captured_at exists on odds_history (non-destructive)
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

-- 2. Define trigger to prevent updates to settled prediction results unless admin override is flagged
CREATE OR REPLACE FUNCTION public.prevent_settlement_updates()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id UUID;
  v_reason TEXT;
BEGIN
  -- Allow bypass only if app.admin_override is set to 'true'
  IF current_setting('app.admin_override', true) = 'true' THEN
    -- Look up the correlation_id from the original SIGNAL_CREATED event
    SELECT correlation_id INTO v_correlation_id
    FROM public.signal_audit_events
    WHERE signal_id = OLD.prediction_id AND event_type = 'SIGNAL_CREATED'
    LIMIT 1;

    -- Safely read custom reason from session variable or use fallback
    BEGIN
      v_reason := current_setting('app.admin_override_reason', true);
    EXCEPTION WHEN OTHERS THEN
      v_reason := 'ADMIN_MANUAL_CORRECTION';
    END;
    IF v_reason IS NULL OR v_reason = '' THEN
      v_reason := 'ADMIN_MANUAL_CORRECTION';
    END IF;

    -- Insert SETTLEMENT_CORRECTED audit trail
    INSERT INTO public.signal_audit_events (signal_id, event_type, source, correlation_id, payload)
    VALUES (
      OLD.prediction_id,
      'SETTLEMENT_CORRECTED',
      'admin',
      COALESCE(v_correlation_id, OLD.prediction_id),
      jsonb_build_object(
        'prediction_id', OLD.prediction_id,
        'old_home_score', OLD.actual_home_score,
        'new_home_score', NEW.actual_home_score,
        'old_away_score', OLD.actual_away_score,
        'new_away_score', NEW.actual_away_score,
        'reason', v_reason,
        'corrected_at', NOW()
      )
    );
    RETURN NEW;
  END IF;

  -- Otherwise, verify and reject result / profit mutations
  IF NEW.actual_home_score IS DISTINCT FROM OLD.actual_home_score OR
     NEW.actual_away_score IS DISTINCT FROM OLD.actual_away_score OR
     NEW.predicted_outcome IS DISTINCT FROM OLD.predicted_outcome OR
     NEW.actual_outcome IS DISTINCT FROM OLD.actual_outcome OR
     NEW.hit_1x2 IS DISTINCT FROM OLD.hit_1x2 OR
     NEW.predicted_ah IS DISTINCT FROM OLD.predicted_ah OR
     NEW.actual_ah IS DISTINCT FROM OLD.actual_ah OR
     NEW.hit_ah IS DISTINCT FROM OLD.hit_ah OR
     NEW.predicted_ou IS DISTINCT FROM OLD.predicted_ou OR
     NEW.actual_ou IS DISTINCT FROM OLD.actual_ou OR
     NEW.hit_ou IS DISTINCT FROM OLD.hit_ou OR
     NEW.profit_1x2 IS DISTINCT FROM OLD.profit_1x2 OR
     NEW.profit_ah IS DISTINCT FROM OLD.profit_ah OR
     NEW.profit_ou IS DISTINCT FROM OLD.profit_ou THEN
    RAISE EXCEPTION 'Settlement records are immutable. Results cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_settlement_updates ON public.prediction_results;
CREATE TRIGGER trg_prevent_settlement_updates
BEFORE UPDATE ON public.prediction_results
FOR EACH ROW EXECUTE FUNCTION public.prevent_settlement_updates();
