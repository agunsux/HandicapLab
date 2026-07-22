-- ========================================================
-- EPIC 40 — Public Ledger, Transparency & Scientific Reproducibility Schema
-- ========================================================
-- 1. public_prediction_ledger (Sequential prediction ID #000001, hashes, SHA256)
-- 2. public_settlements (Append-only settlement outcomes, CLV, ROI)
-- 3. scientific_reports (Automated weekly & monthly reports)
-- 4. hall_records (Hall of Fame & Hall of Shame with root cause postmortems)
-- 5. model_evolution_releases (v1.00 to v1.40.0 release history)

CREATE TABLE IF NOT EXISTS public.public_prediction_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_number BIGSERIAL UNIQUE NOT NULL, -- Sequential ID e.g. 1 -> #000001
  fixture_id TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  model_prob NUMERIC(6,4) NOT NULL,
  ci_lower NUMERIC(6,4) NOT NULL,
  ci_upper NUMERIC(6,4) NOT NULL,
  model_fair_odds NUMERIC(6,3) NOT NULL,
  bookmaker_odds NUMERIC(6,3) NOT NULL,
  prob_edge NUMERIC(6,4) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL,
  recommendation TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_version TEXT NOT NULL,
  prediction_hash TEXT NOT NULL,
  dataset_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'TAMPER_EVIDENT', 'UNVERIFIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pub_ledger_number ON public.public_prediction_ledger(prediction_number);
CREATE INDEX IF NOT EXISTS idx_pub_ledger_fixture ON public.public_prediction_ledger(fixture_id);

CREATE TABLE IF NOT EXISTS public.public_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID UNIQUE REFERENCES public.public_prediction_ledger(id) ON DELETE CASCADE,
  closing_odds NUMERIC(6,3) NOT NULL,
  closing_prob NUMERIC(6,4) NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('WIN', 'LOSS', 'PUSH', 'HALF_WIN', 'HALF_LOSS')),
  profit NUMERIC(8,4) NOT NULL,
  clv NUMERIC(8,4) NOT NULL,
  realized_roi NUMERIC(8,4) NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.scientific_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('WEEKLY', 'MONTHLY')),
  period_identifier TEXT NOT NULL, -- e.g. "2026-W31" or "2026-08"
  total_predictions INT NOT NULL,
  realized_roi NUMERIC(8,4) NOT NULL,
  avg_clv NUMERIC(8,4) NOT NULL,
  brier_score NUMERIC(6,4) NOT NULL,
  ece NUMERIC(6,4) NOT NULL,
  report_markdown TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.hall_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('HALL_OF_FAME', 'HALL_OF_SHAME')),
  record_type TEXT NOT NULL, -- e.g. 'LARGEST_EDGE', 'WORST_PREDICTION'
  fixture_name TEXT NOT NULL,
  predicted_prob NUMERIC(6,4) NOT NULL,
  bookmaker_odds NUMERIC(6,3) NOT NULL,
  expected_value NUMERIC(6,4) NOT NULL,
  result TEXT NOT NULL,
  postmortem_notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.model_evolution_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  release_name TEXT NOT NULL,
  release_date TIMESTAMPTZ NOT NULL,
  accepted_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  realized_roi_improvement NUMERIC(6,2) NOT NULL DEFAULT 0.0,
  notes TEXT NOT NULL
);
