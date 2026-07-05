-- Migration: 00000000000015_quant_research_engine.sql
-- Goal: Support Hypothesis Registry, Experiment Tracking, and Research Audits.

CREATE TABLE IF NOT EXISTS public.wh_hypotheses (
  id BIGSERIAL PRIMARY KEY,
  hypothesis_id VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- market_inefficiency, team_performance, referee_bias
  researcher VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, running, completed, validated, rejected, production, archived
  priority VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_experiments (
  id BIGSERIAL PRIMARY KEY,
  experiment_id VARCHAR(100) NOT NULL UNIQUE,
  hypothesis_id VARCHAR(100) NOT NULL REFERENCES public.wh_hypotheses(hypothesis_id) ON DELETE CASCADE,
  dataset VARCHAR(100) NOT NULL,
  feature_set JSONB DEFAULT '[]'::jsonb,
  parameters JSONB DEFAULT '{}'::jsonb,
  walk_forward_split VARCHAR(100) NOT NULL,
  
  -- Metrics
  roi NUMERIC(6,2),
  sharpe NUMERIC(6,2),
  max_drawdown NUMERIC(6,2),
  brier_score NUMERIC(6,4),
  log_loss NUMERIC(6,4),
  
  -- Provenance
  generator_version VARCHAR(50) NOT NULL,
  git_commit VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wh_research_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  operator VARCHAR(100) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  changes_json JSONB DEFAULT '{}'::jsonb,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE public.wh_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wh_research_audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT POLICIES
CREATE POLICY "Select Hypotheses" ON public.wh_hypotheses FOR SELECT USING (true);
CREATE POLICY "Select Experiments" ON public.wh_experiments FOR SELECT USING (true);
CREATE POLICY "Select Research Audit Logs" ON public.wh_research_audit_logs FOR SELECT USING (true);
