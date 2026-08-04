-- 1. Fix matches check constraint to allow both club and international matches
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_competition_type_check;
ALTER TABLE matches ADD CONSTRAINT matches_competition_type_check CHECK (competition_type IN ('club', 'international'));

-- 2. Add missing Phase 1 and Sprint 6 columns to predictions table
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_subtype TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS selection TEXT;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_probability DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS fair_odds DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS entry_odds DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS market_confidence_score INTEGER;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_odds DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS closing_line_value DOUBLE PRECISION;

-- 3. Add missing Phase 1 and Sprint 6 columns to paper_trades table
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS market_subtype TEXT;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS selection TEXT;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS entry_odds DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS opening_odds DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS cohort_tag TEXT DEFAULT 'GENERAL';
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS profit DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS is_win BOOLEAN;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS clv DOUBLE PRECISION;
ALTER TABLE paper_trades ADD COLUMN IF NOT EXISTS brier_score DOUBLE PRECISION;
