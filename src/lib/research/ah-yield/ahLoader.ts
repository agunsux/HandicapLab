// AH YIELD ENGINE — Real-data loaders (frozen europe-dataset-v1 + market_odds.jsonl).
// Read-only JSONL parsing. No synthetic fallbacks: missing files throw.

import * as fs from 'fs';
import * as path from 'path';
import type { CanonicalMatchRecord, MarketOddsRecord } from './ahTypes';

export interface AhDataPaths {
  canonicalMatches: string;
  marketOdds: string;
}

export const DEFAULT_AH_DATA_PATHS: AhDataPaths = {
  canonicalMatches: path.join(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl'),
  marketOdds: path.join(process.cwd(), 'data', 'golden', 'europe', 'market_odds.jsonl'),
};

function readJsonl<T>(filePath: string, map: (raw: Record<string, unknown>, lineNumber: number) => T): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`AH data file missing: ${filePath} (DATA NOT AVAILABLE)`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const out: T[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    out.push(map(JSON.parse(line) as Record<string, unknown>, i + 1));
  }
  return out;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function loadCanonicalMatches(filePath: string = DEFAULT_AH_DATA_PATHS.canonicalMatches): CanonicalMatchRecord[] {
  return readJsonl<CanonicalMatchRecord>(filePath, (r) => ({
    canonicalId: String(r.canonicalId),
    leagueId: String(r.leagueId),
    cluster: String(r.cluster ?? ''),
    season: String(r.season),
    matchDate: String(r.matchDate),
    homeTeam: String(r.homeTeam),
    awayTeam: String(r.awayTeam),
    homeGoals: Number(r.homeGoals),
    awayGoals: Number(r.awayGoals),
    result: String(r.result),
    resultVerified: Boolean(r.resultVerified),
    totalGoals: Number(r.totalGoals),
  }));
}

export function loadMarketOdds(filePath: string = DEFAULT_AH_DATA_PATHS.marketOdds): MarketOddsRecord[] {
  return readJsonl<MarketOddsRecord>(filePath, (r) => ({
    oddsId: String(r.odds_id),
    canonicalId: String(r.canonical_id),
    leagueId: String(r.league_id),
    cluster: String(r.cluster ?? ''),
    season: String(r.season),
    matchDate: String(r.match_date),
    market: String(r.market),
    observation: String(r.observation),
    bookmakerSource: String(r.bookmaker_source),
    line: numOrNull(r.line),
    homeOdds: numOrNull(r.home_odds),
    drawOdds: numOrNull(r.draw_odds),
    awayOdds: numOrNull(r.away_odds),
    overOdds: numOrNull(r.over_odds),
    underOdds: numOrNull(r.under_odds),
    sourceFile: String(r.source_file ?? ''),
    sourceRow: Number(r.source_row ?? 0),
    datasetVersion: String(r.dataset_version ?? ''),
    ingestionVersion: String(r.ingestion_version ?? ''),
  }));
}

export function loadAhRawData(paths: AhDataPaths = DEFAULT_AH_DATA_PATHS): {
  matches: CanonicalMatchRecord[];
  odds: MarketOddsRecord[];
} {
  return {
    matches: loadCanonicalMatches(paths.canonicalMatches),
    odds: loadMarketOdds(paths.marketOdds),
  };
}
