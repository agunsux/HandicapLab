-- ============================================================
-- HandicapLab: picks pipeline tables (quota-safe daily engine)
-- Idempotent. Coexists with legacy `picks` table.
-- ============================================================

-- ---------- daily_picks ----------
CREATE TABLE IF NOT EXISTS public.daily_picks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id         UUID NOT NULL,
  league             TEXT,
  home_team          TEXT,
  away_team          TEXT,
  kickoff_utc        TIMESTAMPTZ,
  market_type        TEXT NOT NULL
                     CHECK (market_type IN ('ASIAN_HANDICAP','OVER_UNDER','MONEYLINE')),
  prediction         TEXT,
  model_probability  DOUBLE PRECISION,
  fair_odds          DOUBLE PRECISION,
  market_odds        DOUBLE PRECISION,
  market_bookmaker   TEXT,
  edge_pct           DOUBLE PRECISION,
  confidence         INT,
  verdict            TEXT CHECK (verdict IN ('LAYAK','PANTAU','LEWATI')),
  reasoning          TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','WON','LOST','PUSH')),
  actual_score       TEXT,
  profit_loss        DOUBLE PRECISION DEFAULT 0,
  clv                DOUBLE PRECISION,
  source             TEXT NOT NULL DEFAULT 'live'
                     CHECK (source IN ('live','backtest')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at         TIMESTAMPTZ,
  -- idempotent upsert key (a fixture can have one pick per market per source)
  CONSTRAINT daily_picks_unique UNIQUE (fixture_id, market_type, source)
);

CREATE INDEX IF NOT EXISTS idx_daily_picks_created  ON public.daily_picks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_picks_status   ON public.daily_picks (status);
CREATE INDEX IF NOT EXISTS idx_daily_picks_fixture  ON public.daily_picks (fixture_id);
CREATE INDEX IF NOT EXISTS idx_daily_picks_kickoff  ON public.daily_picks (kickoff_utc);

-- ---------- odds_snapshots (append-only, for CLV) ----------
-- Instead of recreating the table (which already exists from phase 3),
-- we safely add the required columns for the daily picks pipeline.
ALTER TABLE public.odds_snapshots
  ADD COLUMN IF NOT EXISTS fixture_id      UUID,
  ADD COLUMN IF NOT EXISTS snapshot_label  TEXT CHECK (snapshot_label IN ('opening','midday','closing')),
  ADD COLUMN IF NOT EXISTS ah_home_line    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ah_home_odds    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ah_away_odds    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ou_line         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ou_over_odds    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ou_under_odds   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ml_home         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ml_draw         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ml_away         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS snapshot_time   TIMESTAMPTZ DEFAULT now();

-- Ensure backward compatibility with existing data
CREATE INDEX IF NOT EXISTS idx_odds_snap_fixture ON public.odds_snapshots (fixture_id);
CREATE INDEX IF NOT EXISTS idx_odds_snap_time    ON public.odds_snapshots (snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_odds_snap_book    ON public.odds_snapshots (bookmaker);

-- Add Unique Constraint for idempotent insertion
ALTER TABLE public.odds_snapshots
  DROP CONSTRAINT IF EXISTS odds_snapshots_unique;
ALTER TABLE public.odds_snapshots
  ADD CONSTRAINT odds_snapshots_unique UNIQUE (fixture_id, bookmaker, snapshot_label);

-- ---------- track_record (single row, updated nightly) ----------
CREATE TABLE IF NOT EXISTS public.track_record (
  id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_picks        INT DEFAULT 0,
  wins               INT DEFAULT 0,
  losses             INT DEFAULT 0,
  pushes             INT DEFAULT 0,
  win_rate           DOUBLE PRECISION DEFAULT 0,
  roi                DOUBLE PRECISION DEFAULT 0,
  cumulative_profit  DOUBLE PRECISION DEFAULT 0,
  avg_edge           DOUBLE PRECISION DEFAULT 0,
  avg_clv            DOUBLE PRECISION DEFAULT 0,
  brier_score        DOUBLE PRECISION,
  live_start_date    DATE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single row if missing (idempotent)
INSERT INTO public.track_record (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------- backtest_summary (single row, from historical seeder) ----------
CREATE TABLE IF NOT EXISTS public.backtest_summary (
  id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  seasons        TEXT,
  total_matches  INT,
  total_picks    INT,
  win_rate       DOUBLE PRECISION,
  roi            DOUBLE PRECISION,
  brier          DOUBLE PRECISION,
  avg_clv        DOUBLE PRECISION,
  max_drawdown   DOUBLE PRECISION,
  per_market     JSONB,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Frontend (anon) reads picks/track record; only backend
-- (service_role) writes. Adjust if your app uses authenticated users.
-- ============================================================
ALTER TABLE public.daily_picks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_record     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_summary ENABLE ROW LEVEL SECURITY;

-- Read policies (anon + authenticated can SELECT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='daily_picks_read') THEN
    CREATE POLICY daily_picks_read ON public.daily_picks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='track_record_read') THEN
    CREATE POLICY track_record_read ON public.track_record FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='backtest_summary_read') THEN
    CREATE POLICY backtest_summary_read ON public.backtest_summary FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='odds_snapshots_read') THEN
    CREATE POLICY odds_snapshots_read ON public.odds_snapshots FOR SELECT USING (true);
  END IF;
END $$;

-- NOTE: service_role bypasses RLS by default, so the backend pipeline
-- can INSERT/UPDATE without extra policies. Do NOT add anon write policies.

-- ============================================================
-- REALTIME (so the Terminal Noir frontend updates live)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE tablename='daily_picks' AND pubname='supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_picks;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE tablename='track_record' AND pubname='supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.track_record;
  END IF;
END $$;
