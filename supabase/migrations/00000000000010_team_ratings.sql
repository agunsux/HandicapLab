-- Migration: Create team_ratings table for Sprint 8 Dynamic Team Ratings
-- Sequence number: 00000000000010

CREATE TABLE IF NOT EXISTS public.team_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  league_id TEXT,
  attack_strength NUMERIC DEFAULT 1.0,
  defense_strength NUMERIC DEFAULT 1.0,
  home_advantage NUMERIC DEFAULT 1.10,
  matches_played INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_team_ratings_team_id ON public.team_ratings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_ratings_league_id ON public.team_ratings(league_id);

-- Enable RLS
ALTER TABLE public.team_ratings ENABLE ROW LEVEL SECURITY;

-- Select policy (readable by everyone)
CREATE POLICY team_ratings_public_read ON public.team_ratings
  FOR SELECT USING (true);
