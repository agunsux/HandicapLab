-- Add BTTS columns to odds_snapshots
ALTER TABLE public.odds_snapshots
ADD COLUMN btts_yes_odds DOUBLE PRECISION,
ADD COLUMN btts_no_odds DOUBLE PRECISION;

-- Update daily_picks market_type constraint to include BTTS
ALTER TABLE public.daily_picks
DROP CONSTRAINT IF EXISTS daily_picks_market_type_check;

ALTER TABLE public.daily_picks
ADD CONSTRAINT daily_picks_market_type_check 
CHECK (market_type IN ('ASIAN_HANDICAP','OVER_UNDER','MONEYLINE','BTTS'));
