-- Migration: Prediction Ledger v2 (Production Grade)
-- Sequence number: 00000000000039
-- Description: Creates 9 normalized idempotent tables, partitions, audit metadata, and materialized views.

-----------------------------------------------------------
-- 0. SCHEMA MIGRATION META TABLE
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations_meta (
  migration_name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  schema_version VARCHAR(20) NOT NULL
);

-----------------------------------------------------------
-- 1. DETECT AND MIGRATE EXISTING PREDICTION_SNAPSHOTS TABLE
-----------------------------------------------------------
DO $$
BEGIN
  -- If prediction_snapshots exists and is not partitioned, rename it
  IF EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'prediction_snapshots' 
      AND n.nspname = 'public' 
      AND c.relkind = 'r' -- Ordinary table
  ) THEN
    ALTER TABLE public.prediction_snapshots RENAME TO prediction_snapshots_old;
    ALTER TABLE public.prediction_snapshots_old RENAME CONSTRAINT prediction_snapshots_pkey TO prediction_snapshots_old_pkey;
  END IF;
END $$;

-----------------------------------------------------------
-- 2. PARTITIONED BASE SNAPSHOT TABLE
-----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prediction_snapshots (
  snapshot_id UUID DEFAULT gen_random_uuid(),
  id UUID DEFAULT gen_random_uuid(), -- Backward compatibility column
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
  
  -- Quantitative indicators (No JSON for optimization)
  probability_home DOUBLE PRECISION,
  probability_draw DOUBLE PRECISION,
  probability_away DOUBLE PRECISION,
  expected_goals_home DOUBLE PRECISION,
  expected_goals_away DOUBLE PRECISION,
  confidence_score DOUBLE PRECISION,
  data_quality_score DOUBLE PRECISION,
  recommendation_label VARCHAR(50),
  
  -- Metadata & Diagnostics
  model_version VARCHAR(50),
  engine_version VARCHAR(50),
  git_commit VARCHAR(50),
  provider_versions JSONB,
  
  -- Context parameters
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
  
  -- Fingerprinting & Tracking
  hash_fingerprint TEXT,
  hash_algorithm VARCHAR(20) DEFAULT 'sha256',
  parent_prediction_uuid UUID,
  
  -- Backward compatibility columns
  prediction JSONB,
  confidence NUMERIC,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL, -- cron, api, manual
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL,
  
  PRIMARY KEY (snapshot_id, snapshot_time)
) PARTITION BY RANGE (snapshot_time);

-- Safe creation of partitions for 2026, 2027, 2028, and a fallback default partition
CREATE TABLE IF NOT EXISTS public.prediction_snapshots_2026 PARTITION OF public.prediction_snapshots
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
    
CREATE TABLE IF NOT EXISTS public.prediction_snapshots_2027 PARTITION OF public.prediction_snapshots
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.prediction_snapshots_2028 PARTITION OF public.prediction_snapshots
    FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2029-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.prediction_snapshots_default PARTITION OF public.prediction_snapshots DEFAULT;

-- Idempotent Indexes
CREATE INDEX IF NOT EXISTS idx_pred_snap_match_id ON public.prediction_snapshots(match_id);
CREATE INDEX IF NOT EXISTS idx_pred_snap_uuid ON public.prediction_snapshots(prediction_uuid);
CREATE INDEX IF NOT EXISTS idx_pred_snap_hash ON public.prediction_snapshots(hash_fingerprint);

-- Before insert trigger to sync `id` and `snapshot_id`
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

-- Immutability Trigger
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

-----------------------------------------------------------
-- 3. COPY LEGACY DATA IF RENAME OCCURRED
-----------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'prediction_snapshots_old' 
      AND n.nspname = 'public'
  ) THEN
    -- Copy data safely
    INSERT INTO public.prediction_snapshots (
      id,
      snapshot_id,
      prediction_uuid,
      match_id,
      kickoff_time,
      snapshot_time,
      model_version,
      prediction,
      confidence,
      created_at,
      hash_fingerprint,
      created_by,
      source_system,
      schema_version
    )
    SELECT
      id,
      id as snapshot_id,
      gen_random_uuid() as prediction_uuid,
      match_id,
      COALESCE(created_at, NOW()) as kickoff_time,
      COALESCE(created_at, NOW()) as snapshot_time,
      model_version,
      prediction,
      confidence,
      COALESCE(created_at, NOW()) as created_at,
      'legacy_migration_' || id::text as hash_fingerprint,
      'migration' as created_by,
      'legacy' as source_system,
      '1.0.0' as schema_version
    FROM public.prediction_snapshots_old
    ON CONFLICT (snapshot_id, snapshot_time) DO NOTHING;
    
    DROP TABLE IF EXISTS public.prediction_snapshots_old;
  END IF;
END $$;

-----------------------------------------------------------
-- 4. CHILD TABLES (DEPENDENCIES)
-----------------------------------------------------------

-- 4.1 Features
CREATE TABLE IF NOT EXISTS public.prediction_snapshot_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  feature_name TEXT NOT NULL,
  feature_value DOUBLE PRECISION,
  normalized_value DOUBLE PRECISION,
  weight DOUBLE PRECISION,
  importance DOUBLE PRECISION,
  source_provenance JSONB NOT NULL, -- { engine, provider, timestamp, latency, confidence }
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_feat_snap ON public.prediction_snapshot_features(snapshot_id);

-- 4.2 Markets
CREATE TABLE IF NOT EXISTS public.prediction_snapshot_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  pinnacle_odds DOUBLE PRECISION,
  bet365_odds DOUBLE PRECISION,
  betfair_odds DOUBLE PRECISION,
  market_average DOUBLE PRECISION,
  market_median DOUBLE PRECISION,
  opening_odds DOUBLE PRECISION,
  current_odds DOUBLE PRECISION,
  implied_prob DOUBLE PRECISION,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_mkt_snap ON public.prediction_snapshot_markets(snapshot_id);

-- 4.3 Explainability
CREATE TABLE IF NOT EXISTS public.prediction_snapshot_explainability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  positive_factors JSONB NOT NULL,
  negative_factors JSONB NOT NULL,
  uncertainty_factors JSONB NOT NULL,
  missing_data JSONB NOT NULL,
  shap_values JSONB,
  feature_importance JSONB,
  reasoning_tree JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_expl_snap ON public.prediction_snapshot_explainability(snapshot_id);

-- 4.4 Execution Metadata
CREATE TABLE IF NOT EXISTS public.prediction_snapshot_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  snapshot_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  execution_time_ms INT,
  api_latency_ms INT,
  provider_latency_ms INT,
  cron_id TEXT,
  worker_id TEXT,
  git_commit TEXT,
  docker_image TEXT,
  environment VARCHAR(50) DEFAULT 'production',
  retry_count INT DEFAULT 0,
  provider_failures JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_exec_snap ON public.prediction_snapshot_execution(snapshot_id);

-----------------------------------------------------------
-- 5. GLOBAL ENTITIES, SETTLEMENTS & MODEL VERSIONS
-----------------------------------------------------------

-- 5.1 Model Versions
CREATE TABLE IF NOT EXISTS public.prediction_model_versions (
  prediction_uuid UUID PRIMARY KEY,
  engine_version TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  elo_version TEXT NOT NULL,
  calibration_version TEXT NOT NULL,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);

-- 5.2 Settlements
CREATE TABLE IF NOT EXISTS public.prediction_settlements (
  settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_uuid UUID NOT NULL UNIQUE,
  snapshot_id UUID NOT NULL,
  match_result JSONB NOT NULL, -- { home_goals, away_goals }
  closing_odds DOUBLE PRECISION,
  line_movement DOUBLE PRECISION,
  clv DOUBLE PRECISION,
  kelly_recommended DOUBLE PRECISION,
  brier_contribution DOUBLE PRECISION,
  logloss_contribution DOUBLE PRECISION,
  settlement_reason TEXT NOT NULL, -- Normal, Void, Cancelled, etc.
  roi DOUBLE PRECISION,
  profit DOUBLE PRECISION,
  loss DOUBLE PRECISION,
  paper_trade BOOLEAN DEFAULT FALSE,
  calibration_bucket VARCHAR(20),
  reliability_bucket VARCHAR(20),
  
  -- Audit fields
  settled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_set_uuid ON public.prediction_settlements(prediction_uuid);

-- 5.3 Calibration Metrics
CREATE TABLE IF NOT EXISTS public.prediction_calibration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket VARCHAR(20) NOT NULL,
  predicted_prob DOUBLE PRECISION NOT NULL,
  actual_prob DOUBLE PRECISION NOT NULL,
  ece DOUBLE PRECISION,
  mce DOUBLE PRECISION,
  brier DOUBLE PRECISION,
  logloss DOUBLE PRECISION,
  reliability_bucket VARCHAR(20),
  historical_percentile DOUBLE PRECISION,
  confidence_bucket VARCHAR(20),
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);

-- 5.4 Feedback Loop
CREATE TABLE IF NOT EXISTS public.prediction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_uuid UUID NOT NULL,
  feature_drift JSONB,
  model_drift JSONB,
  market_efficiency JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by VARCHAR(50) DEFAULT 'cron' NOT NULL,
  source_system VARCHAR(50) DEFAULT 'handicaplab' NOT NULL,
  schema_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pred_feed_uuid ON public.prediction_feedback(prediction_uuid);

-----------------------------------------------------------
-- 6. MATERIALIZED VIEWS (For Performance Metrics)
-----------------------------------------------------------

-- 6.1 ROI Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_roi;
CREATE MATERIALIZED VIEW public.mv_prediction_roi AS
SELECT 
  s.league,
  s.season,
  s.model_version,
  SUM(st.profit) as total_profit,
  SUM(st.loss) as total_loss,
  AVG(st.roi) as avg_roi,
  COUNT(st.settlement_id) as settled_count
FROM public.prediction_snapshots s
JOIN public.prediction_settlements st ON s.prediction_uuid = st.prediction_uuid
GROUP BY s.league, s.season, s.model_version;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_roi_uniq ON public.mv_prediction_roi (league, season, model_version);

-- 6.2 Accuracy Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_accuracy;
CREATE MATERIALIZED VIEW public.mv_prediction_accuracy AS
SELECT 
  s.market,
  s.model_version,
  COUNT(st.settlement_id) as total,
  SUM(CASE WHEN st.profit > 0 THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN st.loss > 0 THEN 1 ELSE 0 END) as losses,
  (SUM(CASE WHEN st.profit > 0 THEN 1 ELSE 0 END)::DOUBLE PRECISION / COUNT(st.settlement_id)) * 100 as accuracy_pct
FROM public.prediction_snapshots s
JOIN public.prediction_settlements st ON s.prediction_uuid = st.prediction_uuid
GROUP BY s.market, s.model_version;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_acc_uniq ON public.mv_prediction_accuracy (market, model_version);

-- 6.3 CLV Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_clv;
CREATE MATERIALIZED VIEW public.mv_prediction_clv AS
SELECT 
  s.league,
  s.market,
  AVG(st.clv) as avg_clv,
  AVG(st.line_movement) as avg_line_movement
FROM public.prediction_snapshots s
JOIN public.prediction_settlements st ON s.prediction_uuid = st.prediction_uuid
GROUP BY s.league, s.market;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_clv_uniq ON public.mv_prediction_clv (league, market);

-- 6.4 Calibration Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_calibration;
CREATE MATERIALIZED VIEW public.mv_prediction_calibration AS
SELECT 
  st.calibration_bucket,
  AVG(st.brier_contribution) as avg_brier,
  AVG(st.logloss_contribution) as avg_logloss,
  COUNT(st.settlement_id) as sample_count
FROM public.prediction_settlements st
GROUP BY st.calibration_bucket;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_calib_uniq ON public.mv_prediction_calibration (calibration_bucket);

-- 6.5 Market Performance Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_market;
CREATE MATERIALIZED VIEW public.mv_prediction_market AS
SELECT 
  s.market,
  SUM(st.profit - st.loss) as net_profit,
  AVG(st.roi) as avg_roi,
  COUNT(st.settlement_id) as total_signals
FROM public.prediction_snapshots s
JOIN public.prediction_settlements st ON s.prediction_uuid = st.prediction_uuid
GROUP BY s.market;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mkt_uniq ON public.mv_prediction_market (market);

-- 6.6 League Performance Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_league;
CREATE MATERIALIZED VIEW public.mv_prediction_league AS
SELECT 
  s.league,
  SUM(st.profit - st.loss) as net_profit,
  AVG(st.roi) as avg_roi,
  COUNT(st.settlement_id) as total_signals
FROM public.prediction_snapshots s
JOIN public.prediction_settlements st ON s.prediction_uuid = st.prediction_uuid
GROUP BY s.league;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_lg_uniq ON public.mv_prediction_league (league);

-- 6.7 Model Version Performance Materialized View
DROP MATERIALIZED VIEW IF EXISTS public.mv_prediction_model;
CREATE MATERIALIZED VIEW public.mv_prediction_model AS
SELECT 
  s.model_version,
  SUM(st.profit - st.loss) as net_profit,
  AVG(st.roi) as avg_roi,
  COUNT(st.settlement_id) as total_signals
FROM public.prediction_snapshots s
JOIN public.prediction_settlements st ON s.prediction_uuid = st.prediction_uuid
GROUP BY s.model_version;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mod_uniq ON public.mv_prediction_model (model_version);

-----------------------------------------------------------
-- 7. REFRESH HELPER FUNCTION
-----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_ledger_materialized_views()
RETURNS void AS $$
BEGIN
  -- Check if views contain data before attempting refresh concurrently (requires unique indexes, which we created)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_roi') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_roi;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_accuracy') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_accuracy;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_clv') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_clv;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_calibration') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_calibration;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_market') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_market;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_league') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_league;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_prediction_model') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_prediction_model;
  END IF;
END;
$$ LANGUAGE plpgsql;
