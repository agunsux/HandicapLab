-- EPIC 52 Stage D — Rivalry Pairs Reference Table
-- Manually curated, versioned. No auto-derived "vibes" scores.
-- is_derby: true for historically recognized derbies.
-- rivalry_intensity: 0-3 scale documented below.
--   0 = no rivalry
--   1 = geographic proximity / common history (e.g. Liverpool-Everton)
--   2 = intense local derby (e.g. Celtic-Rangers, Boca-River)
--   3 = top-tier continental rivalry (e.g. Barcelona-Real Madrid, Bayern-Dortmund)
-- Each row has a version/updated_at field for traceability (Rule #2).

CREATE TABLE IF NOT EXISTS rivalry_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  is_derby BOOLEAN NOT NULL DEFAULT FALSE,
  rivalry_intensity INTEGER NOT NULL DEFAULT 0 CHECK (rivalry_intensity >= 0 AND rivalry_intensity <= 3),
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_a, team_b)
);

CREATE INDEX IF NOT EXISTS idx_rivalry_pairs_team_a ON rivalry_pairs(team_a);
CREATE INDEX IF NOT EXISTS idx_rivalry_pairs_team_b ON rivalry_pairs(team_b);

COMMENT ON TABLE rivalry_pairs IS 'Manually curated football rivalry pairs for feature enrichment (EPIC 52 Stage D). Versioned reference data.';
COMMENT ON COLUMN rivalry_pairs.rivalry_intensity IS '0=none, 1=geographic/historical, 2=intense derby, 3=top-tier continental rivalry';

-- Seed known derbies (EPL focus, extendable)
INSERT INTO rivalry_pairs (team_a, team_b, is_derby, rivalry_intensity, notes) VALUES
  ('Liverpool', 'Everton', TRUE, 2, 'Merseyside Derby'),
  ('Manchester United', 'Manchester City', TRUE, 2, 'Manchester Derby'),
  ('Manchester United', 'Liverpool', TRUE, 1, 'North West Derby'),
  ('Arsenal', 'Tottenham', TRUE, 2, 'North London Derby'),
  ('Chelsea', 'Arsenal', TRUE, 1, 'London Derby'),
  ('Chelsea', 'Tottenham', TRUE, 1, 'London Derby'),
  ('Barcelona', 'Real Madrid', TRUE, 3, 'El Clasico'),
  ('Real Madrid', 'Barcelona', TRUE, 3, 'El Clasico'),
  ('Bayern Munich', 'Borussia Dortmund', TRUE, 2, 'Der Klassiker'),
  ('AC Milan', 'Inter Milan', TRUE, 2, 'Derby della Madonnina'),
  ('Juventus', 'Inter Milan', TRUE, 1, 'Derby d Italia'),
  ('Juventus', 'AC Milan', TRUE, 1, 'Derby d Italia'),
  ('Roma', 'Lazio', TRUE, 2, 'Derby della Capitale'),
  ('Celtic', 'Rangers', TRUE, 3, 'Old Firm Derby'),
  ('Liverpool', 'Chelsea', TRUE, 1, 'Rivalry fixture'),
  ('Arsenal', 'Manchester United', TRUE, 1, 'Historic rivalry'),
  ('Paris Saint Germain', 'Olympique Marseille', TRUE, 2, 'Le Classique'),
  ('Benfica', 'Porto', TRUE, 2, 'O Classico'),
  ('Porto', 'Benfica', TRUE, 2, 'O Classico'),
  ('Ajax', 'Feyenoord', TRUE, 2, 'De Klassieker'),
  ('Besiktas', 'Galatasaray', TRUE, 2, 'Intercontinental Derby'),
  ('Galatasaray', 'Fenerbahce', TRUE, 2, 'Istanbul Derby'),
  ('Sevilla', 'Real Betis', TRUE, 2, 'Seville Derby'),
  ('Atletico Madrid', 'Real Madrid', TRUE, 2, 'Madrid Derby')
ON CONFLICT (team_a, team_b) DO NOTHING;
