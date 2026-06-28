/**
 * One-time DDL migration: creates the odds_ingestion_runs table.
 *
 * This table is owned by the odds pipeline.
 * It stores per-run observability metrics for the capture-odds and
 * generate-signals cron jobs. It is separate from cron_runs (which
 * tracks process-level outcomes).
 *
 * Run:
 *   npx tsx src/scripts/create-odds-ingestion-runs-table.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('[Migration] Creating odds_ingestion_runs table...');

  // Use raw SQL via supabase rpc to execute DDL
  const ddl = `
    CREATE TABLE IF NOT EXISTS odds_ingestion_runs (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_id          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
      cron_name             TEXT NOT NULL,
      run_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
      fixtures_received     INT NOT NULL DEFAULT 0,
      odds_enriched         INT NOT NULL DEFAULT 0,
      odds_rejected         INT NOT NULL DEFAULT 0,
      signals_generated     INT NOT NULL DEFAULT 0,
      fixtures_without_odds INT NOT NULL DEFAULT 0,
      rejection_log         JSONB NOT NULL DEFAULT '[]'::jsonb
    );

    COMMENT ON TABLE odds_ingestion_runs IS
      'Per-run observability metrics for the odds ingestion pipeline (capture-odds, generate-signals). Owned exclusively by the odds pipeline — never written to by match ingestion.';

    COMMENT ON COLUMN odds_ingestion_runs.rejection_log IS
      'Array of OddsRejection objects. Each entry contains: reason (malformed_price | missing_market | invalid_bookmaker | missing_line), homeTeam, awayTeam, market, and optional detail string.';
  `;

  const { error } = await supabase.rpc('exec_sql', { sql: ddl }).maybeSingle();

  if (error) {
    // exec_sql RPC may not be available — fall back to direct insert probe
    // to verify table already exists, which is fine.
    console.warn('[Migration] rpc exec_sql not available or failed:', error.message);
    console.log('[Migration] Checking if table already exists via probe...');

    const { error: probeError } = await supabase
      .from('odds_ingestion_runs')
      .select('id')
      .limit(1);

    if (probeError) {
      console.error('[Migration] Table does not exist and DDL failed. Run the following SQL manually in Supabase SQL Editor:');
      console.log(`
-- ────────────────────────────────────────────────────────────────
-- HandicapLab: odds_ingestion_runs table
-- Run this in the Supabase SQL Editor for your project.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS odds_ingestion_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  cron_name             TEXT NOT NULL,
  run_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  fixtures_received     INT NOT NULL DEFAULT 0,
  odds_enriched         INT NOT NULL DEFAULT 0,
  odds_rejected         INT NOT NULL DEFAULT 0,
  signals_generated     INT NOT NULL DEFAULT 0,
  fixtures_without_odds INT NOT NULL DEFAULT 0,
  rejection_log         JSONB NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE odds_ingestion_runs IS
  'Per-run observability metrics for the odds ingestion pipeline (capture-odds, generate-signals). Owned exclusively by the odds pipeline.';
      `);
      process.exit(1);
    } else {
      console.log('[Migration] Table odds_ingestion_runs already exists. Nothing to do.');
    }
  } else {
    console.log('[Migration] ✅ odds_ingestion_runs table created successfully.');
  }

  // Verify
  const { data, error: verifyError } = await supabase
    .from('odds_ingestion_runs')
    .select('id')
    .limit(1);

  if (verifyError) {
    console.error('[Migration] Post-creation verification failed:', verifyError.message);
    process.exit(1);
  }

  console.log('[Migration] ✅ Verification passed. odds_ingestion_runs is accessible.');
  console.log('[Migration] Row count (should be 0 on first run):', data?.length ?? 0);
}

run().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
