-- Phase 3: Data & Intelligence Layer
-- Location: supabase/migrations/00000000000003_phase3_data_intelligence.sql

-- Predictions
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  market_type TEXT,
  market_subtype TEXT,
  selection TEXT,
  home_team TEXT,
  away_team TEXT,
  prediction JSONB,
  odds_snapshot JSONB,
  closing_odds JSONB,
  model_version TEXT,
  feature_version TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  prediction_timestamp TIMESTAMPTZ,
  brier_score DOUBLE PRECISION,
  clv DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confidence DOUBLE PRECISION,
  model_confidence DOUBLE PRECISION,
  data_confidence DOUBLE PRECISION,
  market_confidence DOUBLE PRECISION,
  league_id TEXT,
  cohort_tag TEXT,
  model_probability DOUBLE PRECISION,
  fair_odds DOUBLE PRECISION,
  entry_odds DOUBLE PRECISION,
  market_confidence_score INTEGER,
  predicted_odds DOUBLE PRECISION,
  closing_line_value DOUBLE PRECISION
);
CREATE INDEX idx_predictions_match_id ON public.predictions(match_id);
CREATE INDEX idx_predictions_market_type ON public.predictions(market_type);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Predictions are viewable by everyone." ON public.predictions FOR SELECT USING (true);

-- Prediction Results (Normalized and evaluated side by side with predictions)
CREATE TABLE public.prediction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  actual_home_score INTEGER NOT NULL,
  actual_away_score INTEGER NOT NULL,
  predicted_outcome VARCHAR(10) NOT NULL,
  actual_outcome VARCHAR(10) NOT NULL,
  hit_1x2 BOOLEAN NOT NULL,
  predicted_ah VARCHAR(20) NOT NULL,
  actual_ah VARCHAR(20) NOT NULL,
  hit_ah BOOLEAN NOT NULL,
  predicted_ou VARCHAR(10) NOT NULL,
  actual_ou VARCHAR(10) NOT NULL,
  hit_ou BOOLEAN NOT NULL,
  profit_1x2 DECIMAL(5,2),
  profit_ah DECIMAL(5,2),
  profit_ou DECIMAL(5,2),
  correlation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prediction_results_match_id ON public.prediction_results(match_id);
CREATE INDEX idx_prediction_results_correlation_id ON public.prediction_results(correlation_id);
ALTER TABLE public.prediction_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prediction results are viewable by everyone." ON public.prediction_results FOR SELECT USING (true);

-- SQL Function for Accuracy
CREATE OR REPLACE FUNCTION get_prediction_accuracy(p_model_version text DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  accuracy_1x2 DECIMAL;
  accuracy_ah DECIMAL;
  accuracy_ou DECIMAL;
  result_json JSON;
END;
$$ LANGUAGE plpgsql;

-- Correct get_prediction_accuracy implementation
CREATE OR REPLACE FUNCTION get_prediction_accuracy(p_model_version text DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  accuracy_1x2 DECIMAL;
  accuracy_ah DECIMAL;
  accuracy_ou DECIMAL;
BEGIN
  IF p_model_version IS NULL THEN
    SELECT COUNT(*) INTO total_count FROM prediction_results;
  ELSE
    SELECT COUNT(*) INTO total_count 
    FROM prediction_results pr
    JOIN predictions p ON pr.prediction_id = p.id
    WHERE p.model_version = p_model_version;
  END IF;
  
  IF total_count = 0 THEN
    RETURN json_build_object(
      'total', 0,
      'accuracy1x2', 0,
      'accuracyAh', 0,
      'accuracyOu', 0
    );
  END IF;

  IF p_model_version IS NULL THEN
    SELECT AVG(CASE WHEN hit_1x2 THEN 1 ELSE 0 END) * 100 INTO accuracy_1x2
    FROM prediction_results;
    
    SELECT AVG(CASE WHEN hit_ah THEN 1 ELSE 0 END) * 100 INTO accuracy_ah
    FROM prediction_results;
    
    SELECT AVG(CASE WHEN hit_ou THEN 1 ELSE 0 END) * 100 INTO accuracy_ou
    FROM prediction_results;
  ELSE
    SELECT AVG(CASE WHEN pr.hit_1x2 THEN 1 ELSE 0 END) * 100 INTO accuracy_1x2
    FROM prediction_results pr
    JOIN predictions p ON pr.prediction_id = p.id
    WHERE p.model_version = p_model_version;
    
    SELECT AVG(CASE WHEN pr.hit_ah THEN 1 ELSE 0 END) * 100 INTO accuracy_ah
    FROM prediction_results pr
    JOIN predictions p ON pr.prediction_id = p.id
    WHERE p.model_version = p_model_version;
    
    SELECT AVG(CASE WHEN pr.hit_ou THEN 1 ELSE 0 END) * 100 INTO accuracy_ou
    FROM prediction_results pr
    JOIN predictions p ON pr.prediction_id = p.id
    WHERE p.model_version = p_model_version;
  END IF;
  
  RETURN json_build_object(
    'total', total_count,
    'accuracy1x2', ROUND(accuracy_1x2, 2),
    'accuracyAh', ROUND(accuracy_ah, 2),
    'accuracyOu', ROUND(accuracy_ou, 2)
  );
END;
$$ LANGUAGE plpgsql;

-- Signals Table
CREATE TABLE IF NOT EXISTS public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  kickoff_utc TIMESTAMPTZ,
  market TEXT NOT NULL,
  handicap_line NUMERIC,
  selection TEXT,
  odds NUMERIC,
  fair_odds NUMERIC,
  probability NUMERIC,
  edge_pct NUMERIC,
  confidence NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  rating_version TEXT,
  calibration_version TEXT,
  feature_snapshot JSONB,
  confidence_score NUMERIC,
  is_anomaly BOOLEAN DEFAULT false,
  anomaly_reason TEXT,
  competition_type TEXT,
  opening_line NUMERIC,
  closing_line NUMERIC,
  opening_odds NUMERIC,
  closing_odds NUMERIC,
  model_version TEXT DEFAULT 'rule_v1',
  locked_at TIMESTAMPTZ,
  opening_reference_book TEXT,
  CONSTRAINT unique_match_market_handicap UNIQUE (match_id, market, handicap_line)
);
CREATE INDEX IF NOT EXISTS idx_signals_kickoff_utc ON public.signals(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_match_id ON public.signals(match_id);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signals readable by everyone" ON public.signals FOR SELECT USING (true);

-- Signal locking trigger
CREATE OR REPLACE FUNCTION public.prevent_prediction_updates_on_locked()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id UUID;
BEGIN
  IF NEW.kickoff_utc <= NOW() AND NEW.locked_at IS NULL THEN
    NEW.locked_at := NOW();
  END IF;

  IF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL THEN
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

  IF OLD.locked_at IS NOT NULL OR (OLD.kickoff_utc <= NOW() AND TG_OP = 'UPDATE') THEN
    IF NEW.locked_at IS NULL THEN
      NEW.locked_at := NOW();
    END IF;

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

-- Odds Snapshots
CREATE TABLE IF NOT EXISTS public.odds_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,
  line NUMERIC,
  odds NUMERIC,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_match_id ON public.odds_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_captured_at ON public.odds_snapshots(captured_at);
CREATE INDEX IF NOT EXISTS idx_odds_snapshots_bookmaker ON public.odds_snapshots(bookmaker);
ALTER TABLE public.odds_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Odds snapshots viewable by everyone" ON public.odds_snapshots FOR SELECT USING (true);

-- Odds History
CREATE TABLE IF NOT EXISTS public.odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT,
  market_type TEXT,
  home_odds DOUBLE PRECISION,
  draw_odds DOUBLE PRECISION,
  away_odds DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'pinnacle',
  line NUMERIC,
  odds NUMERIC,
  captured_at TIMESTAMPTZ,
  correlation_id UUID,
  provider_timestamp TIMESTAMPTZ,
  api_request_id TEXT,
  source_version TEXT
);
CREATE INDEX IF NOT EXISTS idx_odds_history_recorded_at ON public.odds_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_odds_history_signal_id ON public.odds_history(signal_id);
ALTER TABLE public.odds_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Odds history viewable by everyone" ON public.odds_history FOR SELECT USING (true);

-- Signal Audit Events
CREATE TABLE IF NOT EXISTS public.signal_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  correlation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signal_audit_events_signal_id ON public.signal_audit_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_audit_events_created_at ON public.signal_audit_events(created_at);
ALTER TABLE public.signal_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signal audit events viewable by everyone" ON public.signal_audit_events FOR SELECT USING (true);

-- Prevent Updates trigger for Signal Audit
CREATE OR REPLACE FUNCTION public.prevent_audit_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update_delete ON public.signal_audit_events;
CREATE TRIGGER trg_prevent_audit_update_delete
BEFORE UPDATE OR DELETE ON public.signal_audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_update_delete();

-- Attach Locking trigger to Signals
DROP TRIGGER IF EXISTS trg_prevent_prediction_updates_on_locked ON public.signals;
CREATE TRIGGER trg_prevent_prediction_updates_on_locked
BEFORE UPDATE ON public.signals
FOR EACH ROW EXECUTE FUNCTION public.prevent_prediction_updates_on_locked();

-- Signal Metrics
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
ALTER TABLE public.signal_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signal metrics readable by everyone" ON public.signal_metrics FOR SELECT USING (true);

-- Settlement Corrections
CREATE TABLE IF NOT EXISTS public.settlement_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  prediction_result_id UUID NOT NULL REFERENCES public.prediction_results(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.settlement_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settlement corrections readable by everyone" ON public.settlement_corrections FOR SELECT USING (true);

-- Trigger to log settlement corrections and protect settlement history
CREATE OR REPLACE FUNCTION public.prevent_settlement_updates()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id UUID;
  v_reason TEXT;
BEGIN
  IF current_setting('app.admin_override', true) = 'true' THEN
    SELECT correlation_id INTO v_correlation_id
    FROM public.signal_audit_events
    WHERE signal_id = OLD.id AND event_type = 'SIGNAL_CREATED'
    LIMIT 1;

    BEGIN
      v_reason := current_setting('app.admin_override_reason', true);
    EXCEPTION WHEN OTHERS THEN
      v_reason := 'ADMIN_MANUAL_CORRECTION';
    END;
    IF v_reason IS NULL OR v_reason = '' THEN
      v_reason := 'ADMIN_MANUAL_CORRECTION';
    END IF;

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
      OLD.id,
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

-- Signal Events
CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signal_events_signal_id ON public.signal_events(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_created_at ON public.signal_events(created_at);
ALTER TABLE public.signal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signal events readable by everyone" ON public.signal_events FOR SELECT USING (true);

-- Signal Performance Attribution
CREATE TABLE IF NOT EXISTS public.signal_performance_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  attribution_factor TEXT NOT NULL,
  weight NUMERIC DEFAULT 1.0,
  clv_impact NUMERIC DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.signal_performance_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attributions readable by everyone" ON public.signal_performance_attribution FOR SELECT USING (true);

-- Model Calibration History
CREATE TABLE IF NOT EXISTS public.model_calibration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signals(id) ON DELETE CASCADE,
  calibration_score NUMERIC NOT NULL,
  brier_score NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.model_calibration_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Calibrations readable by everyone" ON public.model_calibration_history FOR SELECT USING (true);

-- Normalized partitioned prediction snapshot architecture (Ledger v2)
CREATE TABLE IF NOT EXISTS public.schema_migrations_meta (
  migration_name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  schema_version VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
  snapshot_id UUID DEFAULT gen_random_uuid(),
  id UUID DEFAULT gen_random_uuid(),
  prediction_uuid UUID,
  match_id TEXT NOT NULL,
  kickoff_time TIMESTAMPTZ,
  snapshot_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  league TEXT,
  season TEXT,
  market TEXT,
  selection TEXT,
  line TEXT,
  odds DOUBLE PRECISION,
  opening_odds DOUBLE PRECISION,
  closing_odds DOUBLE PRECISION,
  probability_home DOUBLE PRECISION,
  probability_draw DOUBLE PRECISION,
  probability_away DOUBLE PRECISION,
  expected_goals_home DOUBLE PRECISION,
  expected_goals_away DOUBLE PRECISION,
  confidence_score DOUBLE PRECISION,
  data_quality_score DOUBLE PRECISION,
  recommendation_label VARCHAR(50),
  model_version VARCHAR(50),
  engine_version VARCHAR(50),
  git_commit VARCHAR(50),
  provider_versions JSONB,
  weather JSONB,
  stadium TEXT,
  timezone TEXT,
  formation JSONB,
  injuries JSONB,
  lineups JSONB,
  elo_snapshot JSONB,
  xg_snapshot JSONB,
  feature_vector JSONB,
  probability_vector JSONB,
  calibration_metadata JSONB,
  hash_fingerprint TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'sha256',
  parent_prediction_uuid UUID,
  prediction JSONB,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL,
  PRIMARY KEY (snapshot_id, snapshot_time)
) PARTITION BY RANGE (snapshot_time);

CREATE TABLE IF NOT EXISTS public.prediction_snapshots_2026 PARTITION OF public.prediction_snapshots
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS public.prediction_snapshots_2027 PARTITION OF public.prediction_snapshots
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS public.prediction_snapshots_2028 PARTITION OF public.prediction_snapshots
    FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2029-01-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS public.prediction_snapshots_default PARTITION OF public.prediction_snapshots DEFAULT;

CREATE INDEX IF NOT EXISTS idx_pred_snap_match_id ON public.prediction_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_pred_snap_uuid ON public.prediction_snapshots(prediction_uuid);
CREATE INDEX IF NOT EXISTS idx_pred_snap_hash ON public.prediction_snapshots(hash_fingerprint);

-- Triggers for prediction snapshots
CREATE OR REPLACE FUNCTION public.sync_snapshot_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := COALESCE(NEW.snapshot_id, gen_random_uuid());
  END IF;
  IF NEW.snapshot_id IS NULL THEN
    NEW.snapshot_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_snapshot_ids_trigger ON public.prediction_snapshots;
CREATE TRIGGER sync_snapshot_ids_trigger
  BEFORE INSERT ON public.prediction_snapshots
  FOR EACH ROW EXECUTE PROCEDURE public.sync_snapshot_ids();

CREATE OR REPLACE FUNCTION public.suppress_snapshot_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability violation: Updates to prediction_snapshots are strictly prohibited. You must INSERT a new revision.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_snapshot_immutability ON public.prediction_snapshots;
CREATE TRIGGER enforce_snapshot_immutability
  BEFORE UPDATE ON public.prediction_snapshots
  FOR EACH ROW EXECUTE PROCEDURE public.suppress_snapshot_updates();

-- Normalized child tables for prediction snapshots
CREATE TABLE IF NOT EXISTS public.prediction_snapshot_features (
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  feature_value DOUBLE PRECISION NOT NULL,
  importance_score DOUBLE PRECISION,
  z_score DOUBLE PRECISION,
  raw_value TEXT,
  PRIMARY KEY (snapshot_id, snapshot_time, feature_name),
  FOREIGN KEY (snapshot_id, snapshot_time) REFERENCES public.prediction_snapshots(snapshot_id, snapshot_time) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_markets (
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  market_name VARCHAR(50) NOT NULL,
  selection_name VARCHAR(50) NOT NULL,
  line VARCHAR(20) NOT NULL,
  odds DOUBLE PRECISION NOT NULL,
  fair_odds DOUBLE PRECISION,
  model_probability DOUBLE PRECISION,
  expected_value DOUBLE PRECISION,
  kelly_stake DOUBLE PRECISION,
  implied_probability DOUBLE PRECISION,
  PRIMARY KEY (snapshot_id, snapshot_time, market_name, selection_name, line),
  FOREIGN KEY (snapshot_id, snapshot_time) REFERENCES public.prediction_snapshots(snapshot_id, snapshot_time) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_explainability (
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  factor_name VARCHAR(100) NOT NULL,
  impact_direction VARCHAR(10) NOT NULL, -- UP, DOWN, NEUTRAL
  impact_magnitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  PRIMARY KEY (snapshot_id, snapshot_time, factor_name),
  FOREIGN KEY (snapshot_id, snapshot_time) REFERENCES public.prediction_snapshots(snapshot_id, snapshot_time) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.prediction_snapshot_execution (
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  execution_channel VARCHAR(50) NOT NULL, -- paper_trading, sharp_ledger, telegram_bot
  status VARCHAR(20) DEFAULT 'queued' NOT NULL, -- queued, executed, skipped, failed
  executed_at TIMESTAMPTZ,
  execution_details JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (snapshot_id, snapshot_time, execution_channel),
  FOREIGN KEY (snapshot_id, snapshot_time) REFERENCES public.prediction_snapshots(snapshot_id, snapshot_time) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.prediction_model_versions (
  version_string VARCHAR(50) PRIMARY KEY,
  release_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  git_commit VARCHAR(50),
  hyperparameters JSONB DEFAULT '{}'::jsonb,
  features_list TEXT[] DEFAULT '{}'::TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prediction_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_uuid UUID NOT NULL,
  match_id TEXT NOT NULL,
  market VARCHAR(50) NOT NULL,
  selection VARCHAR(50) NOT NULL,
  line VARCHAR(20) NOT NULL,
  outcome VARCHAR(20) NOT NULL, -- VOID, HALF_VOID, WIN, LOSS, HALF_WIN, HALF_LOSS
  profit_loss DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
  clv DOUBLE PRECISION,
  brier_score DOUBLE PRECISION,
  settled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  verified BOOLEAN DEFAULT FALSE NOT NULL,
  verified_by VARCHAR(50) DEFAULT 'cron' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_settle_uuid ON public.prediction_settlements(prediction_uuid);
CREATE INDEX IF NOT EXISTS idx_pred_settle_match ON public.prediction_settlements(match_id);

CREATE TABLE IF NOT EXISTS public.prediction_calibration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version VARCHAR(50) REFERENCES public.prediction_model_versions(version_string) ON DELETE SET NULL,
  market VARCHAR(50) NOT NULL,
  sample_size INTEGER NOT NULL,
  brier_score DOUBLE PRECISION NOT NULL,
  calibration_error DOUBLE PRECISION NOT NULL,
  log_loss DOUBLE PRECISION NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.prediction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_uuid UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
