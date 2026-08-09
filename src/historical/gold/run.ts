import * as fs from 'fs';
import * as path from 'path';
import { loadRawMatches } from './load';
import { normalizeMatches } from './normalize';
import { computeFeatureSnapshots } from './features';
import type { GoldSummary, HistoricalOdds, NormalizedMatch, RawMatchRow } from '../types';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');

function buildOdds(matches: NormalizedMatch[], rawById: Map<number, RawMatchRow>): HistoricalOdds[] {
  return matches.map((m) => {
    const raw = rawById.get(m.provider_record_id);
    return {
      match_id: m.canonical_id,
      league: m.league,
      season: m.season,
      match_date: m.match_date,
      bookmaker: 'football-data.co.uk',
      odds_type: 'closing_reference',
      market_1x2: raw && raw.home_odds !== null && raw.draw_odds !== null && raw.away_odds !== null
        ? { home: raw.home_odds, draw: raw.draw_odds, away: raw.away_odds }
        : null,
      market_ou25: raw && raw.over25_odds !== null && raw.under25_odds !== null
        ? { over: raw.over25_odds, under: raw.under25_odds }
        : null,
      source: 'raw_matches (football-data.co.uk E0.csv bulk import)',
    };
  });
}

function writeJsonl(file: string, rows: unknown[]): number {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stream = fs.createWriteStream(file, { flags: 'w' });
  for (const row of rows) stream.write(JSON.stringify(row) + '\n');
  stream.end();
  return rows.length;
}

async function main(): Promise<void> {
  const rows = await loadRawMatches();
  const rawById = new Map(rows.map((r) => [r.id, r]));

  const { matches, excluded, duplicatesFound, resultMismatches } = normalizeMatches(rows);
  const { snapshots, leakage, violations } = computeFeatureSnapshots(matches);
  const odds = buildOdds(matches, rawById);

  writeJsonl(path.join(OUT_DIR, 'normalized_matches.jsonl'), matches);
  writeJsonl(path.join(OUT_DIR, 'historical_odds.jsonl'), odds);
  writeJsonl(path.join(OUT_DIR, 'feature_snapshots.jsonl'), snapshots);
  writeJsonl(path.join(OUT_DIR, 'leakage_audit.jsonl'), leakage);

  const seasonBreakdown: Record<string, number> = {};
  for (const m of matches) seasonBreakdown[m.season] = (seasonBreakdown[m.season] || 0) + 1;

  const summary: GoldSummary = {
    raw_rows_read: rows.length,
    normalized_matches: matches.length,
    excluded,
    duplicates_found: duplicatesFound,
    result_mismatches: resultMismatches,
    matches_with_odds_1x2: odds.filter((o) => o.market_1x2 !== null).length,
    matches_with_odds_ou25: odds.filter((o) => o.market_ou25 !== null).length,
    features_generated: snapshots.length,
    leak_free: violations === 0,
    leakage_violations: violations,
    season_breakdown: seasonBreakdown,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
