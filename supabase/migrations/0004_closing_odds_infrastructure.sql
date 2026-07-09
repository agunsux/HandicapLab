-- Sprint 4: Closing Odds Infrastructure
-- =======================================
-- Provides:
-- 1. market_movements — time-series tracking of odds movements
-- 2. capture_log — audit trail of capture attempts
-- 3. closing_odds — canonical closing odds per fixture/market
-- 4. capture_health — real-time capture quality metrics
-- 5. clv_results — CLV computations per prediction

-- ==========================================
-- 1. MARKET MOVEMENTS (Time-series odds)
-- ==========================================
CREATE TABLE IF NOT EXISTS market_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Match reference
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  fixture_external_id TEXT, -- Provider's fixture ID
  
  -- Market identification
  market_type TEXT NOT NULL CHECK (market_type IN ('moneyline', 'asian_handicap', 'over_under')),
  market_line DECIMAL(10,4),
  
  -- The odds at this point in time
  home_odds DECIMAL(10,4),
  away_odds DECIMAL(10,4),
  draw_odds DECIMAL(10,4),
  
  -- Implied probabilities (vig-free)
  home_prob DECIMAL(6,4),
  away_prob DECIMAL(6,4),
  draw_prob DECIMAL(6,4),
  vig DECIMAL(6,4),
  
  -- Capture metadata
  capture_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  capture_phase TEXT NOT NULL CHECK (capture_phase IN (
    'opening', 't-48h', 't-24h', 't-6h', 't-3h', 't-1h', 't-30m', 't-15m', 't-5m', 'kickoff', 'post-kickoff'
  )),
  provider TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'api',
  
  -- For deduplication
  hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_market_movements_match ON market_movements(match_id);
CREATE INDEX IF NOT EXISTS idx_market_movements_match_market ON market_movements(match_id, market_type);
CREATE INDEX IF NOT EXISTS idx_market_movements_phase ON market_movements(capture_phase);
CREATE INDEX IF NOT EXISTS idx_market_movements_timestamp ON market_movements(capture_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_movements_hash ON market_movements(hash);

-- Unique constraint: one capture per fixture/market/phase
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_movements_unique_capture 
  ON market_movements(match_id, market_type, COALESCE(market_line, 0), capture_phase, provider);

-- ==========================================
-- 2. CAPTURE LOG (Audit trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS capture_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Which fixtures were targeted
  fixture_ids UUID[] NOT NULL,
  league TEXT,
  
  -- What was captured
  markets_captured TEXT[] NOT NULL,
  market_count INTEGER NOT NULL DEFAULT 0,
  
  -- Capture execution
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Provider used
  provider TEXT NOT NULL,
  
  -- Outcome
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'timeout')),
  error_message TEXT,
  retry_attempt INTEGER DEFAULT 0,
  
  -- Coverage metrics
  expected_captures INTEGER DEFAULT 0,
  successful_captures INTEGER DEFAULT 0,
  failed_captures INTEGER DEFAULT 0,
  coverage_pct DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capture_log_status ON capture_log(status);
CREATE INDEX IF NOT EXISTS idx_capture_log_started ON capture_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_capture_log_league ON capture_log(league);

-- ==========================================
-- 3. CLOSING ODDS (Canonical closing lines)
-- ==========================================
-- This is a materialized view of the last capture before kickoff
-- for each fixture/market combination, plus T-1h as fallback.
CREATE TABLE IF NOT EXISTS closing_odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  market_type TEXT NOT NULL CHECK (market_type IN ('moneyline', 'asian_handicap', 'over_under')),
  market_line DECIMAL(10,4),
  
  -- The closing odds (closest to kickoff with valid data)
  home_odds DECIMAL(10,4) NOT NULL,
  away_odds DECIMAL(10,4) NOT NULL,
  draw_odds DECIMAL(10,4),
  
  -- Vig-free probabilities
  home_prob DECIMAL(6,4),
  away_prob DECIMAL(6,4),
  draw_prob DECIMAL(6,4),
  vig DECIMAL(6,4),
  
  -- Capture that provided the closing odds
  captured_at TIMESTAMPTZ NOT NULL,
  capture_phase TEXT NOT NULL,
  provider TEXT NOT NULL,
  
  -- Delay between capture and kickoff (negative = before kickoff)
  kickoff_delay_seconds INTEGER,
  
  -- Opening odds reference (for movement calculation)
  opening_home_odds DECIMAL(10,4),
  opening_away_odds DECIMAL(10,4),
  opening_draw_odds DECIMAL(10,4),
  odds_movement_pct DECIMAL(6,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_closing_odds_unique 
  ON closing_odds(match_id, market_type, COALESCE(market_line, 0));
CREATE INDEX IF NOT EXISTS idx_closing_odds_match ON closing_odds(match_id);

-- ==========================================
-- 4. CLV RESULTS
-- ==========================================
CREATE TABLE IF NOT EXISTS clv_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  market_type TEXT NOT NULL CHECK (market_type IN ('moneyline', 'asian_handicap', 'over_under')),
  
  -- Predicted price & prob (from our model)
  model_price DECIMAL(10,4) NOT NULL,
  model_prob DECIMAL(6,4) NOT NULL,
  
  -- Closing price & prob (from market)
  closing_price DECIMAL(10,4) NOT NULL,
  closing_prob DECIMAL(6,4) NOT NULL,
  
  -- CLV calculation
  clv DECIMAL(8,4) NOT NULL, -- Positive = model beat closing line
  clv_bps INTEGER NOT NULL,  -- CLV in basis points
  
  -- Edge metrics
  edge_vs_closing DECIMAL(8,4), -- (model_prob - closing_prob) / closing_prob
  
  -- Which capture was used
  closing_odds_id UUID REFERENCES closing_odds(id),
  capture_provider TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clv_results_prediction ON clv_results(prediction_id);
CREATE INDEX IF NOT EXISTS idx_clv_results_match ON clv_results(match_id);
CREATE INDEX IF NOT EXISTS idx_clv_results_market ON clv_results(market_type);

-- ==========================================
-- 5. CAPTURE COVERAGE (Dashboard materialized)
-- ==========================================
CREATE TABLE IF NOT EXISTS capture_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  league TEXT NOT NULL,
  season TEXT NOT NULL,
  market_type TEXT NOT NULL,
  
  total_fixtures INTEGER NOT NULL DEFAULT 0,
  fixtures_with_odds INTEGER NOT NULL DEFAULT 0,
  fixtures_with_closing INTEGER NOT NULL DEFAULT 0,
  fixtures_with_full_movement INTEGER NOT NULL DEFAULT 0,
  
  -- Capture quality
  avg_capture_delay_seconds INTEGER,
  avg_captures_per_fixture DECIMAL(6,2),
  capture_success_rate DECIMAL(5,2),
  
  -- Market coverage
  opening_odds_pct DECIMAL(5,2),
  closing_odds_pct DECIMAL(5,2),
  all_three_markets_pct DECIMAL(5,2),
  
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(league, season, market_type)
);

-- ==========================================
-- VIEW: Market Movement Timeline
-- ==========================================
CREATE OR REPLACE VIEW view_market_timeline AS
SELECT 
  mm.match_id,
  m.home_team,
  m.away_team,
  m.league,
  m.kickoff,
  mm.market_type,
  mm.capture_phase,
  mm.home_odds,
  mm.away_odds,
  mm.draw_odds,
  mm.home_prob,
  mm.away_prob,
  mm.draw_prob,
  mm.vig,
  mm.capture_timestamp,
  EXTRACT(EPOCH FROM (mm.capture_timestamp - m.kickoff)) AS seconds_to_kickoff,
  mm.provider
FROM market_movements mm
JOIN matches m ON mm.match_id = m.id
ORDER BY m.kickoff DESC, mm.market_type, mm.capture_timestamp DESC;

-- ==========================================
-- FUNCTION: Get Closing Odds for Match
-- ==========================================
CREATE OR REPLACE FUNCTION get_closing_odds_for_match(p_match_id UUID)
RETURNS TABLE(
  market_type TEXT,
  market_line DECIMAL(10,4),
  home_odds DECIMAL(10,4),
  away_odds DECIMAL(10,4),
  draw_odds DECIMAL(10,4),
  home_prob DECIMAL(6,4),
  away_prob DECIMAL(6,4),
  vig DECIMAL(6,4),
  captured_at TIMESTAMPTZ,
  seconds_before_kickoff INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (co.market_type, COALESCE(co.market_line, 0))
    co.market_type,
    co.market_line,
    co.home_odds,
    co.away_odds,
    co.draw_odds,
    co.home_prob,
    co.away_prob,
    co.vig,
    co.captured_at,
    co.kickoff_delay_seconds
  FROM closing_odds co
  WHERE co.match_id = p_match_id
  ORDER BY co.market_type, COALESCE(co.market_line, 0), co.captured_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Calculate CLV for Prediction
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_clv(
  p_prediction_id UUID,
  p_market_type TEXT
) RETURNS TABLE(
  clv DECIMAL(8,4),
  clv_bps INTEGER,
  edge DECIMAL(8,4)
) AS $$
DECLARE
  v_model_price DECIMAL(10,4);
  v_model_prob DECIMAL(6,4);
  v_closing_price DECIMAL(10,4);
  v_closing_prob DECIMAL(6,4);
  v_clv DECIMAL(8,4);
BEGIN
  -- Get model price (inverse of model probability for moneyline)
  SELECT 
    CASE 
      WHEN p_market_type = 'moneyline' THEN 
        CASE 
          WHEN pr.predicted_outcome = 'home' THEN 1.0 / pr.hit_1x2::int
          ELSE 2.0
        END
      ELSE 2.0
    END,
    0.5
  INTO v_model_price, v_model_prob
  FROM predictions p
  JOIN prediction_results pr ON pr.prediction_id = p.id
  WHERE p.id = p_prediction_id;
  
  -- Get closing odds
  SELECT co.home_odds, co.home_prob
  INTO v_closing_price, v_closing_prob
  FROM closing_odds co
  WHERE co.match_id = (SELECT match_id FROM predictions WHERE id = p_prediction_id)
    AND co.market_type = p_market_type
  ORDER BY co.captured_at DESC
  LIMIT 1;
  
  -- Calculate CLV
  -- CLV = log(model_price / closing_price) for back bets
  IF v_closing_price IS NOT NULL AND v_closing_price > 0 AND v_model_price > 0 THEN
    v_clv := LN(v_model_price / v_closing_price);
  ELSE
    v_clv := 0;
  END IF;
  
  RETURN QUERY SELECT 
    v_clv,
    ROUND(v_clv * 10000)::INTEGER,
    (v_model_prob - v_closing_prob) / NULLIF(v_closing_prob, 0)
  ;
END;
$$ LANGUAGE plpgsql;