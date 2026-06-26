-- Migration: Create signals, performance_snapshots, and odds_snapshots tables
-- Sequence number: 00000000000002

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
  CONSTRAINT unique_match_market_handicap UNIQUE (match_id, market, handicap_line)
);

CREATE INDEX IF NOT EXISTS idx_signals_kickoff_utc ON public.signals(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_signals_status ON public.signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_match_id ON public.signals(match_id);

CREATE TABLE IF NOT EXISTS public.performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE,
  total_signals INTEGER,
  wins INTEGER,
  losses INTEGER,
  roi_units NUMERIC,
  win_rate NUMERIC,
  clv NUMERIC,
  brier_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
