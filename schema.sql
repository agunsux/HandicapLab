-- HandicapLab MVP - Supabase SQL Schema
-- No ORM, flattened predictions, single source of truth per match

-- 1. teams
CREATE TABLE teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    league text NOT NULL,
    footystats_id integer UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. matches
CREATE TABLE matches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    home_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    match_date timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'scheduled', -- scheduled / live / finished
    footystats_id integer UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_teams_different CHECK (home_team_id != away_team_id)
);

-- Index for matches
CREATE INDEX idx_matches_match_date ON matches(match_date);

-- 3. market_snapshots
CREATE TABLE market_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    odds_home double precision,
    odds_draw double precision,
    odds_away double precision,
    asian_handicap_line double precision,
    over_under_line double precision,
    btts_yes_odds double precision,
    btts_no_odds double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for market_snapshots
CREATE INDEX idx_market_snapshots_match_id ON market_snapshots(match_id);

-- 4. stats_snapshots
CREATE TABLE stats_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    xg_home double precision,
    xg_away double precision,
    shots_home integer,
    shots_away integer,
    shots_on_target_home integer,
    shots_on_target_away integer,
    corners_home integer,
    corners_away integer,
    form_home integer, -- last 5 games index
    form_away integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for stats_snapshots
CREATE INDEX idx_stats_snapshots_match_id ON stats_snapshots(match_id);

-- 5. predictions (FLATTENED CORE LEDGER TABLE)
CREATE TABLE predictions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    model_version text NOT NULL,
    
    -- Market probabilities
    ah_home_prob double precision,
    ah_away_prob double precision,
    ou_over_prob double precision,
    ou_under_prob double precision,
    ml_home_prob double precision,
    ml_draw_prob double precision,
    ml_away_prob double precision,
    btts_yes_prob double precision,
    btts_no_prob double precision,
    
    -- Meta
    final_confidence double precision,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for predictions
CREATE INDEX idx_predictions_match_id ON predictions(match_id);

-- 6. outcomes
CREATE TABLE outcomes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    prediction_id uuid NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    result_ah text, -- win / loss / push
    result_ou text, -- win / loss / push
    result_ml text, -- win / loss / push
    result_btts text, -- win / loss / push
    roi double precision,
    settled_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for outcomes
CREATE INDEX idx_outcomes_prediction_id ON outcomes(prediction_id);
