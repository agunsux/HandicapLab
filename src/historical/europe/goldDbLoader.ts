// Gold-layer DB loader for the European historical dataset. Idempotent upserts
// from the canonical JSONL layer into the Supabase gold tables. Intended to run
// in a credentialed environment (production/CI); fails closed locally.
// Location: src/historical/europe/goldDbLoader.ts

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { OUTPUT_DIR } from './ingest';
import { EUROPEAN_LEAGUE_REGISTRY } from './leagueRegistry';
import type { CanonicalMatch, HistoricalManifest } from './types';

const BATCH = 500;

function readJsonl<T>(file: string): T[] {
  const content = fs.readFileSync(file, 'utf-8');
  return content.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as T);
}

export interface GoldLoadPayload {
  matches: Array<Record<string, unknown>>;
  odds: Array<Record<string, unknown>>;
  leagueMeta: Array<Record<string, unknown>>;
  manifest: HistoricalManifest;
}

/**
 * Pure, deterministic construction of the exact rows the loader will write to
 * Supabase — used by tests to prove the load is correct without touching the
 * database. Never invoked against the DB directly.
 *
 * Odds rows come from the real market-observation layer (market_odds.jsonl):
 * one row per (match, market, opening/closing, bookmaker) with the ACTUAL line
 * and odds, plus full provenance. Never invented.
 */
export function buildLoadPayload(): GoldLoadPayload {
  const matches = readJsonl<CanonicalMatch>(path.join(OUTPUT_DIR, 'canonical_matches.jsonl'));

  const matchRows = matches.map((m) => ({
    canonical_id: m.canonicalId,
    league_id: m.leagueId,
    cluster: m.cluster,
    season: m.season,
    match_date: m.matchDate,
    home_team: m.homeTeam,
    away_team: m.awayTeam,
    home_goals: m.homeGoals,
    away_goals: m.awayGoals,
    result: m.result,
    result_verified: m.resultVerified,
    total_goals: m.totalGoals,
    home_win: m.homeWin,
    draw: m.draw,
    away_win: m.awayWin,
    btts: m.btts,
    over15: m.over15, over25: m.over25, over35: m.over35,
    under15: m.under15, under25: m.under25, under35: m.under35,
    source_provider: m.sourceProvider,
    source_file: m.sourceFile,
    source_row: m.sourceRow,
    normalization_version: m.normalizationVersion,
    schema_version: m.schemaVersion,
  }));

  const oddsFile = path.join(OUTPUT_DIR, 'market_odds.jsonl');
  const oddsRows: Array<Record<string, unknown>> = fs.existsSync(oddsFile)
    ? readJsonl<Record<string, unknown>>(oddsFile)
    : [];

  const leagueRows = EUROPEAN_LEAGUE_REGISTRY.map((l) => ({
    league_id: l.leagueId,
    cluster: l.cluster,
    name: l.name,
    country: l.country,
    football_data_code: l.footballDataCode === 'UNKNOWN' ? null : l.footballDataCode,
    status: l.status,
    exclude_reason: l.excludeReason ?? null,
  }));

  const manifest = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'manifest.json'), 'utf-8')) as HistoricalManifest;

  return { matches: matchRows, odds: oddsRows, leagueMeta: leagueRows, manifest };
}

export async function loadGoldLayer(): Promise<{ matches: number; odds: number; leagues: number; manifest: boolean }> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!key || !url) {
    throw new Error('[FAIL CLOSED] SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL missing — gold-layer DB load not executed.');
  }

  const supabase = createClient(url, key);
  const { matches, odds: oddsRows, leagueMeta: leagueRows, manifest } = buildLoadPayload();

  // 1. historical_matches (idempotent, deterministic ordering)
  let mCount = 0;
  for (let i = 0; i < matches.length; i += BATCH) {
    const chunk = matches.slice(i, i + BATCH).map((m) => ({ ...m, ingested_at: new Date().toISOString() }));
    const { error } = await supabase.from('historical_matches').upsert(chunk, { onConflict: 'canonical_id' });
    if (error) throw new Error(`historical_matches upsert failed: ${error.message}`);
    mCount += chunk.length;
  }

  // 2. historical_odds (genuine market-observation rows — never invented)
  let oCount = 0;
  for (let i = 0; i < oddsRows.length; i += BATCH) {
    const chunk = oddsRows.slice(i, i + BATCH);
    const { error } = await supabase.from('historical_odds').upsert(chunk, { onConflict: 'odds_id' });
    if (error) throw new Error(`historical_odds upsert failed: ${error.message}`);
    oCount += chunk.length;
  }

  // 3. historical_league_meta (seed registry incl. EXCLUDED reasons)
  for (let i = 0; i < leagueRows.length; i += BATCH) {
    const chunk = leagueRows.slice(i, i + BATCH);
    const { error } = await supabase.from('historical_league_meta').upsert(chunk, { onConflict: 'league_id' });
    if (error) throw new Error(`historical_league_meta upsert failed: ${error.message}`);
  }

  // 4. manifest (dataset freeze)
  const { error: manError } = await supabase.from('historical_dataset_manifest').upsert({
    dataset_version: manifest.dataset_version,
    generated_at: manifest.generated_at,
    source: manifest.source,
    schema_version: manifest.schema_version,
    normalization_version: manifest.normalization_version,
    raw_record_count: manifest.raw_record_count,
    valid_match_count: manifest.valid_match_count,
    rejected_match_count: manifest.rejected_match_count,
    duplicate_resolved_count: manifest.duplicate_resolved_count,
    duplicate_count: manifest.duplicate_count,
    hash: manifest.hash,
    payload: manifest,
  }, { onConflict: 'dataset_version' });
  if (manError) throw new Error(`historical_dataset_manifest write failed: ${manError.message}`);

  return { matches: mCount, odds: oCount, leagues: leagueRows.length, manifest: true };
}

async function main() {
  try {
    const r = await loadGoldLayer();
    console.log(`Gold layer loaded: matches=${r.matches} odds=${r.odds} leagueMeta=${r.leagues} manifest=${r.manifest}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
}

if (require.main === module || process.argv[1]?.includes('goldDbLoader')) {
  main();
}
