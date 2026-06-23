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
  
  model_version VARCHAR(50) DEFAULT 'prematch-v1',
  feature_version VARCHAR(50) DEFAULT 'basic-v1',
  generated_at TIMESTAMP DEFAULT NOW(),
  prediction_timestamp TIMESTAMP,
  odds_snapshot JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Safe Incremental Migration Statements (if tables already exist)
-- ALTER TABLE predictions ADD COLUMN IF NOT EXISTS model_version VARCHAR(50) DEFAULT 'prematch-v1';
-- ALTER TABLE predictions ADD COLUMN IF NOT EXISTS feature_version VARCHAR(50) DEFAULT 'basic-v1';
-- ALTER TABLE predictions ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP DEFAULT NOW();
-- ALTER TABLE predictions ADD COLUMN IF NOT EXISTS prediction_timestamp TIMESTAMP;
-- ALTER TABLE predictions ADD COLUMN IF NOT EXISTS odds_snapshot JSONB;

-- Index for faster queries
CREATE INDEX idx_matches_kickoff ON matches(kickoff);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_predictions_confidence ON predictions(confidence);
CREATE INDEX IF NOT EXISTS idx_predictions_model_version ON predictions(model_version);


-- Prediction Results table
CREATE TABLE IF NOT EXISTS prediction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  
  actual_home_score INTEGER NOT NULL,
  actual_away_score INTEGER NOT NULL,
  
  -- 1X2 Result
  predicted_outcome VARCHAR(10) NOT NULL, -- 'home', 'draw', 'away'
  actual_outcome VARCHAR(10) NOT NULL,
  hit_1x2 BOOLEAN NOT NULL,
  
  -- Asian Handicap Result
  predicted_ah VARCHAR(20) NOT NULL, -- 'home' or 'away'
  actual_ah VARCHAR(20) NOT NULL,
  hit_ah BOOLEAN NOT NULL,
  
  -- Over/Under Result
  predicted_ou VARCHAR(10) NOT NULL, -- 'over' or 'under'
  actual_ou VARCHAR(10) NOT NULL,
  hit_ou BOOLEAN NOT NULL,
  
  -- Profit/Loss (assuming 1 unit bet)
  profit_1x2 DECIMAL(5,2),
  profit_ah DECIMAL(5,2),
  profit_ou DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for prediction results
CREATE INDEX IF NOT EXISTS idx_prediction_results_match_id ON prediction_results(match_id);
CREATE INDEX IF NOT EXISTS idx_prediction_results_hit_1x2 ON prediction_results(hit_1x2);
CREATE INDEX IF NOT EXISTS idx_prediction_results_hit_ah ON prediction_results(hit_ah);
CREATE INDEX IF NOT EXISTS idx_prediction_results_hit_ou ON prediction_results(hit_ou);

-- SQL Function for Accuracy
CREATE OR REPLACE FUNCTION get_prediction_accuracy()
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  accuracy_1x2 DECIMAL;
  accuracy_ah DECIMAL;
  accuracy_ou DECIMAL;
  result_json JSON;
BEGIN
  SELECT COUNT(*) INTO total_count FROM prediction_results;
  
  IF total_count = 0 THEN
    RETURN json_build_object(
      'total', 0,
      'accuracy1x2', 0,
      'accuracyAh', 0,
      'accuracyOu', 0
    );
  END IF;

  SELECT AVG(CASE WHEN hit_1x2 THEN 1 ELSE 0 END) * 100 INTO accuracy_1x2
  FROM prediction_results;
  
  SELECT AVG(CASE WHEN hit_ah THEN 1 ELSE 0 END) * 100 INTO accuracy_ah
  FROM prediction_results;
  
  SELECT AVG(CASE WHEN hit_ou THEN 1 ELSE 0 END) * 100 INTO accuracy_ou
  FROM prediction_results;
  
  RETURN json_build_object(
    'total', total_count,
    'accuracy1x2', ROUND(accuracy_1x2, 2),
    'accuracyAh', ROUND(accuracy_ah, 2),
    'accuracyOu', ROUND(accuracy_ou, 2)
  );
END;
$$ LANGUAGE plpgsql;
