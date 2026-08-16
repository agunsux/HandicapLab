// Real ML/AH/OU market-observation layer for the frozen europe-dataset-v1.
// Every genuine source observation (bookmaker × market × opening/closing) is
// preserved as its own row with the ACTUAL source line and odds. No collapsing
// of distinct observations, no pseudo-odds, no ML→AH/OU derivation.
// This is a SIBLING artifact of the frozen dataset: canonical_matches.jsonl
// and manifest.json are never touched (dataset hash unchanged).
// Location: src/historical/europe/marketOdds.ts

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { ClusterId } from './types';
import { EUROPEAN_LEAGUE_REGISTRY } from './leagueRegistry';
import { discoverLeagueSources } from './sourceDiscovery';
import { readFootballDataCsv, type RawFootballDataRow } from './footballDataReader';
import { normalizeRecord, canonicalIdOf } from './normalize';

export const MARKET_INGESTION_VERSION = 'europe-odds-v1';
export const DATASET_VERSION_REF = 'europe-dataset-v1';
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'golden', 'europe');

export type MarketCode = 'ML' | 'AH' | 'OU';
export type ObservationCode = 'opening' | 'closing';
export type BookmakerSource = 'pinnacle' | 'bet365' | 'betbrain';

export interface MarketOddsRow {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  cluster: ClusterId;
  season: string;
  match_date: string;
  market: MarketCode;
  observation: ObservationCode;
  bookmaker_source: BookmakerSource | string;
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
  source_file: string;
  source_row: number;
  dataset_version: string;
  ingestion_version: string;
}

interface ObsBuilder {
  market: MarketCode;
  observation: ObservationCode;
  bookmaker: BookmakerSource;
  line: number | null;
  home: number | null;
  draw: number | null;
  away: number | null;
  over: number | null;
  under: number | null;
}

const nonNull = (...v: Array<number | null>): boolean => v.some((x) => x !== null);

/**
 * Deterministic observation policy:
 * - Keep every source observation as its own row (bookmaker × market × open/close).
 * - ML: Pinnacle and Bet365 open/closing rows each when their columns are real.
 * - AH: Pinnacle open (AHh+PAHH/PAHA), Pinnacle close (AHCh+PCAHH/PCAHA),
 *       Bet365 open (B365AHH/AHA, line AHh), Bet365 close (B365CAHH/CAHA, line AHCh),
 *       BetBrain open (BbAHh + BbAvAHH/AHA).
 * - OU: Pinnacle open/close (P>2.5/P<2.5, PC>2.5/PC<2.5, line 2.5),
 *       Bet365 open/close (B365>2.5/<2.5, B365C>2.5/<2.5, line 2.5),
 *       BetBrain open (BbAv>2.5/<2.5, line 2.5).
 * - A row is emitted only when its odds cells are genuinely present.
 */
export function extractMarketObservations(
  row: RawFootballDataRow,
  season: string,
  dateIso: string,
  homeTeam: string,
  awayTeam: string,
  leagueId: string,
  cluster: ClusterId
): MarketOddsRow[] {
  const builders: ObsBuilder[] = [];

  // ML — Pinnacle + Bet365, open and closing.
  if (nonNull(row.h1, row.d1, row.a1)) builders.push({ market: 'ML', observation: 'opening', bookmaker: 'pinnacle', line: null, home: row.h1, draw: row.d1, away: row.a1, over: null, under: null });
  if (nonNull(row.ch1, row.cd1, row.ca1)) builders.push({ market: 'ML', observation: 'closing', bookmaker: 'pinnacle', line: null, home: row.ch1, draw: row.cd1, away: row.ca1, over: null, under: null });
  if (nonNull(row.b365H, row.b365D, row.b365A)) builders.push({ market: 'ML', observation: 'opening', bookmaker: 'bet365', line: null, home: row.b365H, draw: row.b365D, away: row.b365A, over: null, under: null });
  if (nonNull(row.b365CH, row.b365CD, row.b365CA)) builders.push({ market: 'ML', observation: 'closing', bookmaker: 'bet365', line: null, home: row.b365CH, draw: row.b365CD, away: row.b365CA, over: null, under: null });

  // AH — Pinnacle open/close, Bet365 open/close, BetBrain open.
  if (nonNull(row.ahLine, row.ahHome, row.ahAway)) builders.push({ market: 'AH', observation: 'opening', bookmaker: 'pinnacle', line: row.ahLine, home: row.ahHome, draw: null, away: row.ahAway, over: null, under: null });
  if (nonNull(row.chLine, row.chHome, row.chAway)) builders.push({ market: 'AH', observation: 'closing', bookmaker: 'pinnacle', line: row.chLine, home: row.chHome, draw: null, away: row.chAway, over: null, under: null });
  if (nonNull(row.b365AhHome, row.b365AhAway)) builders.push({ market: 'AH', observation: 'opening', bookmaker: 'bet365', line: row.ahLine, home: row.b365AhHome, draw: null, away: row.b365AhAway, over: null, under: null });
  if (nonNull(row.b365AhCloseHome, row.b365AhCloseAway)) builders.push({ market: 'AH', observation: 'closing', bookmaker: 'bet365', line: row.chLine, home: row.b365AhCloseHome, draw: null, away: row.b365AhCloseAway, over: null, under: null });
  if (nonNull(row.bbAhLine, row.bbAhHome, row.bbAhAway)) builders.push({ market: 'AH', observation: 'opening', bookmaker: 'betbrain', line: row.bbAhLine, home: row.bbAhHome, draw: null, away: row.bbAhAway, over: null, under: null });

  // OU — Pinnacle open/close, Bet365 open/close, BetBrain open (line 2.5).
  if (nonNull(row.over, row.under)) builders.push({ market: 'OU', observation: 'opening', bookmaker: 'pinnacle', line: row.ouLine, home: null, draw: null, away: null, over: row.over, under: row.under });
  if (nonNull(row.cover, row.cunder)) builders.push({ market: 'OU', observation: 'closing', bookmaker: 'pinnacle', line: row.couLine, home: null, draw: null, away: null, over: row.cover, under: row.cunder });
  if (nonNull(row.b365Over, row.b365Under)) builders.push({ market: 'OU', observation: 'opening', bookmaker: 'bet365', line: 2.5, home: null, draw: null, away: null, over: row.b365Over, under: row.b365Under });
  if (nonNull(row.b365Cover, row.b365Cunder)) builders.push({ market: 'OU', observation: 'closing', bookmaker: 'bet365', line: 2.5, home: null, draw: null, away: null, over: row.b365Cover, under: row.b365Cunder });
  if (nonNull(row.bbOver, row.bbUnder)) builders.push({ market: 'OU', observation: 'opening', bookmaker: 'betbrain', line: 2.5, home: null, draw: null, away: null, over: row.bbOver, under: row.bbUnder });

  const canonicalId = canonicalIdOf(leagueId, season, dateIso, homeTeam, awayTeam);

  return builders.map((b) => {
    const key = `${canonicalId}|${b.market}|${b.observation}|${b.bookmaker}`;
    return {
      odds_id: createHash('sha256').update(key).digest('hex'),
      canonical_id: canonicalId,
      league_id: leagueId,
      cluster,
      season,
      match_date: dateIso,
      market: b.market,
      observation: b.observation,
      bookmaker_source: b.bookmaker,
      line: b.line,
      home_odds: b.market === 'OU' ? null : b.home,
      draw_odds: b.draw,
      away_odds: b.market === 'OU' ? null : b.away,
      over_odds: b.market === 'OU' ? b.over : null,
      under_odds: b.market === 'OU' ? b.under : null,
      source_file: row.sourceFile,
      source_row: row.sourceRow,
      dataset_version: DATASET_VERSION_REF,
      ingestion_version: MARKET_INGESTION_VERSION,
    };
  });
}

export interface LeagueOddsCoverage {
  leagueId: string;
  matches: number;
  ml_rows: number;
  ml_matches: number;
  ml_coverage_pct: number;
  ah_rows: number;
  ah_matches: number;
  ah_coverage_pct: number;
  ou_rows: number;
  ou_matches: number;
  ou_coverage_pct: number;
}

export interface MarketOddsManifest {
  dataset_version: string;
  ingestion_version: string;
  odds_row_count: number;
  by_market: Record<MarketCode, number>;
  by_league: LeagueOddsCoverage[];
  hash: string;
}

export function buildMarketOddsDataset(): MarketOddsManifest {
  const rows: MarketOddsRow[] = [];
  const leagueStats = new Map<string, { matches: Set<string>; ml: Set<string>; ah: Set<string>; ou: Set<string>; rows: number; mlRows: number; ahRows: number; ouRows: number }>();
  // Cross-source dedup: the same canonical match appears in multiple roots
  // (e.g. EPL in data/bronze + research/quant). Discovery orders descriptors
  // priority-desc within a season, so the FIRST occurrence is the canonical
  // source; its observations are kept, duplicate-source ones are skipped —
  // exactly mirroring the canonical match dedup.
  const emittedMatches = new Set<string>();

  const includeLeague = (leagueId: string) => {
    const s = leagueStats.get(leagueId) ?? { matches: new Set<string>(), ml: new Set<string>(), ah: new Set<string>(), ou: new Set<string>(), rows: 0, mlRows: 0, ahRows: 0, ouRows: 0 };
    leagueStats.set(leagueId, s);
    return s;
  };

  for (const league of EUROPEAN_LEAGUE_REGISTRY) {
    if (league.status !== 'INCLUDED') continue;
    const { descriptors } = discoverLeagueSources(league.leagueId, league.footballDataCode);
    const stats = includeLeague(league.leagueId);

    for (const d of descriptors) {
      const data = readFootballDataCsv(d.filePath, d.season);
      for (const raw of data.rows) {
        if (raw.div !== league.footballDataCode) continue;
        const { match, rejectReason } = normalizeRecord(raw, league);
        if (!match || rejectReason) continue; // only matches that are in the canonical dataset
        if (emittedMatches.has(match.canonicalId)) continue; // duplicate source for same match
        emittedMatches.add(match.canonicalId);
        stats.matches.add(match.canonicalId);
        const obs = extractMarketObservations(raw, match.season, match.matchDate, match.homeTeam, match.awayTeam, match.leagueId, match.cluster);
        for (const o of obs) {
          rows.push(o);
          stats.rows += 1;
          const isOpen = o.observation === 'opening';
          if (o.market === 'ML') { stats.mlRows += 1; if (isOpen) stats.ml.add(o.canonical_id); }
          // AH coverage requires genuine flank odds (a line alone is not a usable price).
          else if (o.market === 'AH') {
            stats.ahRows += 1;
            if (isOpen && (o.home_odds != null || o.away_odds != null)) stats.ah.add(o.canonical_id);
          }
          else { stats.ouRows += 1; if (isOpen) stats.ou.add(o.canonical_id); }
        }
      }
    }
  }

  rows.sort((a, b) =>
    a.canonical_id.localeCompare(b.canonical_id) ||
    a.market.localeCompare(b.market) ||
    a.observation.localeCompare(b.observation) ||
    a.bookmaker_source.localeCompare(b.bookmaker_source)
  );

  const byMarket: Record<MarketCode, number> = { ML: 0, AH: 0, OU: 0 };
  for (const r of rows) byMarket[r.market] += 1;

  const byLeague: LeagueOddsCoverage[] = [];
  for (const league of EUROPEAN_LEAGUE_REGISTRY) {
    if (league.status !== 'INCLUDED') continue;
    const s = leagueStats.get(league.leagueId)!;
    const matches = s.matches.size;
    const pct = (n: number) => (matches > 0 ? Number(((n / matches) * 100).toFixed(2)) : 0);
    byLeague.push({
      leagueId: league.leagueId,
      matches,
      ml_rows: s.mlRows, ml_matches: s.ml.size, ml_coverage_pct: pct(s.ml.size),
      ah_rows: s.ahRows, ah_matches: s.ah.size, ah_coverage_pct: pct(s.ah.size),
      ou_rows: s.ouRows, ou_matches: s.ou.size, ou_coverage_pct: pct(s.ou.size),
    });
  }

  const hash = createHash('sha256').update(rows.map((r) => JSON.stringify(r)).join('\n')).digest('hex');
  const manifest: MarketOddsManifest = {
    dataset_version: DATASET_VERSION_REF,
    ingestion_version: MARKET_INGESTION_VERSION,
    odds_row_count: rows.length,
    by_market: byMarket,
    by_league: byLeague,
    hash,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'market_odds.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'market_odds_manifest.json'), JSON.stringify(manifest, null, 2));

  return manifest;
}
