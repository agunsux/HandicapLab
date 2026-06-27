-- Migration: Production Data Quality, Analytics & Observability Layer
-- Sequence number: 00000000000031

-- 1. Alter signals to add model_version
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'rule_v1';

-- 2. Alter odds_history to add provenance fields
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS provider_timestamp TIMESTAMPTZ;
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS api_request_id TEXT;
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS market_type TEXT;
ALTER TABLE public.odds_history ADD COLUMN IF NOT EXISTS source_version TEXT;

-- 3. Create signal_metrics table
CREATE TABLE IF NOT EXISTS public.signal_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  quality_score NUMERIC NOT NULL,
  sharp_score NUMERIC NOT NULL,
  clv_score NUMERIC NOT NULL,
  liquidity_score NUMERIC NOT NULL,
  confidence_score NUMERIC NOT NULL,
  model_version TEXT NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_signal_metric UNIQUE(signal_id)
);

-- 4. Create settlement_corrections table
CREATE TABLE IF NOT EXISTS public.settlement_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  prediction_result_id UUID NOT NULL REFERENCES public.prediction_results(prediction_id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Update settlement updates trigger function
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

    -- Insert into public.settlement_corrections
    INSERT INTO public.settlement_corrections (
      signal_id,
      prediction_result_id,
      changed_by,
      reason,
      old_value,
      new_value,
      created_at
    ) VALUES (
      OLD.prediction_id,
      OLD.prediction_id,
      'admin',
      v_reason,
      jsonb_build_object(
        'actual_home_score', OLD.actual_home_score,
        'actual_away_score', OLD.actual_away_score,
        'profit_1x2', OLD.profit_1x2,
        'profit_ah', OLD.profit_ah,
        'profit_ou', OLD.profit_ou
      ),
      jsonb_build_object(
        'actual_home_score', NEW.actual_home_score,
        'actual_away_score', NEW.actual_away_score,
        'profit_1x2', NEW.profit_1x2,
        'profit_ah', NEW.profit_ah,
        'profit_ou', NEW.profit_ou
      ),
      now()
    );

    -- Insert into signal_audit_events as well
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
