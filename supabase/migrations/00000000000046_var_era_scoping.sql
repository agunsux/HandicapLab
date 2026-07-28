-- EPIC 52 Stage E — VAR-Era Historical Data Scoping
-- Adds var_era boolean to matches table and tags per-league cutoff dates.
-- Pre-VAR data is FLAGGED, not deleted (still usable for team-strength priors).
-- The primary calibration/backtest pipeline must default to var_era=true
-- unless explicitly opted into mixed-regime analysis.
--
-- VAR introduction per league (confirmed):
--   Bundesliga:    2017-18 season  -> Aug 2017
--   Serie A:       2017-18 season  -> Aug 2017
--   La Liga:       2018-19 season  -> Aug 2018
--   Ligue 1:       2018-19 season  -> Aug 2018
--   Premier League: 2019-20 season -> Aug 2019
--   Champions League: 2019-20 season -> Aug 2019

ALTER TABLE matches ADD COLUMN IF NOT EXISTS var_era BOOLEAN;

-- Backfill: tag existing rows per league + kickoff date
UPDATE matches SET var_era = TRUE
WHERE var_era IS NULL
  AND (
    (league = 'English Premier League' AND kickoff >= '2019-08-01') OR
    (league = 'Premier League' AND kickoff >= '2019-08-01') OR
    (league = 'La Liga' AND kickoff >= '2018-08-01') OR
    (league = 'Bundesliga' AND kickoff >= '2017-08-01') OR
    (league = 'Serie A' AND kickoff >= '2017-08-01') OR
    (league = 'Ligue 1' AND kickoff >= '2018-08-01') OR
    (league = 'UEFA Champions League' AND kickoff >= '2019-08-01') OR
    (league = 'Champions League' AND kickoff >= '2019-08-01')
  );

-- Remaining unmatched rows (pre-VAR or unrecognised league) = false
UPDATE matches SET var_era = FALSE WHERE var_era IS NULL;

ALTER TABLE matches ALTER COLUMN var_era SET NOT NULL;
ALTER TABLE matches ALTER COLUMN var_era SET DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_matches_var_era ON matches(var_era);

COMMENT ON COLUMN matches.var_era IS 'TRUE if match was played after VAR was introduced in its league. Pre-VAR rows are flagged, not deleted — usable for long-run priors but excluded from primary calibration by default.';
