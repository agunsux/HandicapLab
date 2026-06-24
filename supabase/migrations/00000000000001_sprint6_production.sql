-- Sprint 6 Production Activation Migrations

-- 1. Create paper_trades table
CREATE TABLE IF NOT EXISTS paper_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT,
  competition_id TEXT,
  market_type TEXT,
  prediction_id UUID,
  odds DOUBLE PRECISION,
  stake DOUBLE PRECISION,
  status TEXT DEFAULT 'pending',
  pnl DOUBLE PRECISION,
  closing_clv DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create odds_history table
CREATE TABLE IF NOT EXISTS odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT,
  market_type TEXT,
  home_odds DOUBLE PRECISION,
  draw_odds DOUBLE PRECISION,
  away_odds DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Alter matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_type TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_home INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_ranking_away INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_home INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_strength_away INTEGER;

-- 4. Alter predictions table
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_confidence DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS data_confidence DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_confidence DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS league_id TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS cohort_tag TEXT;
