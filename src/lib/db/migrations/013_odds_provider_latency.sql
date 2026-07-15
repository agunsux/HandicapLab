-- 013_odds_provider_latency
-- Epic 31A Section A: explicitly store per-tick provider latency on the odds row.
-- ADDITIVE ONLY — extends odds_snapshots without altering existing columns,
-- indexes, or the append-only chain. Safe to apply on the live pipeline.

ALTER TABLE odds_snapshots
  ADD COLUMN IF NOT EXISTS provider_latency_ms INTEGER;

COMMENT ON COLUMN odds_snapshots.provider_latency_ms IS
  'Round-trip latency (ms) of the provider fetch that produced this tick. Epic 31A A.';
