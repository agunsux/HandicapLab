-- HandicapLab Production Schema
-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team VARCHAR(100) NOT NULL,
  away_team VARCHAR(100) NOT NULL,
  league VARCHAR(50) NOT NULL,
  kickoff TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming',
  home_goals INTEGER,
  away_goals INTEGER,
  ht_home_goals INTEGER,
  ht_away_goals INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Predictions table
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  
  home_prob DECIMAL(5,4) NOT NULL,
  draw_prob DECIMAL(5,4) NOT NULL,
  away_prob DECIMAL(5,4) NOT NULL,
  
  ah_line DECIMAL(3,2) NOT NULL,
  ah_prob DECIMAL(5,4) NOT NULL,
  ah_confidence VARCHAR(10) NOT NULL,
  
  ou_line DECIMAL(3,1) NOT NULL,
  over_prob DECIMAL(5,4) NOT NULL,
  ou_confidence VARCHAR(10) NOT NULL,
  
  expected_goals DECIMAL(3,2),
  confidence VARCHAR(10) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_matches_kickoff ON matches(kickoff);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_predictions_confidence ON predictions(confidence);
