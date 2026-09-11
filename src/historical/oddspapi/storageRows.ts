// ============================================================================
// Storage rows for OddsPapi historical odds (historical_odds table)
// ============================================================================
// One row per (canonical match, market, opening/closing, bookmaker) with the
// ACTUAL provider line, per-side odds and per-side timestamps. Lines are never
// collapsed: AH -0.5 and AH -0.75 are distinct rows.
//
// Rows are only built from real observations. Missing closing → no closing row
// (never a fabricated price). Rejections are returned with reason codes.

import * as crypto from 'crypto';
import type { MarketObservationSet, SeriesSelectionResult } from './observationSeries';
import type { SelectionSide, StorageMarket } from './marketCatalog';

export interface HistoricalOddsRow {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  cluster: string;
  season: string;
  match_date: string;
  market: StorageMarket;
  observation: 'opening' | 'closing';
  bookmaker_source: string;
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
  yes_odds: number | null;
  no_odds: number | null;
  source_file: string;
  source_row: number;
  dataset_version: string;
  ingestion_version: string;
  provider: string;
  provider_event_id: string;
  odds_timestamp: string | null;
  home_odds_timestamp: string | null;
  away_odds_timestamp: string | null;
  market_id: number;
}

export interface BuildOddsRowsInput {
  set: MarketObservationSet;
  bookmaker: string;
  provider: string;
  providerEventId: string;
  canonicalId: string;
  leagueId: string;
  cluster: string;
  season: string;
  matchDate: string;
  datasetVersion: string;
  ingestionVersion: string;
}

export interface OddsRowRejection {
  marketId: number;
  market: StorageMarket | null;
  reason: string;
}

export interface PartialBook {
  marketId: number;
  market: StorageMarket;
  observation: 'opening' | 'closing';
  sides: number;
  expected: number;
}

const OBSERVATIONS: Array<'opening' | 'closing'> = ['opening', 'closing'];

function observationPoint(
  selection: SeriesSelectionResult,
  observation: 'opening' | 'closing'
): { price: number; createdAt: string } | null {
  const point = observation === 'opening' ? selection.entry : selection.closing;
  if (!point) return null;
  if (!Number.isFinite(point.price) || point.price <= 1) return null;
  return { price: point.price, createdAt: point.createdAt };
}

function deterministicOddsId(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function assignOdds(
  market: StorageMarket,
  side: SelectionSide,
  price: number,
  row: Pick<HistoricalOddsRow, 'home_odds' | 'draw_odds' | 'away_odds' | 'over_odds' | 'under_odds' | 'yes_odds' | 'no_odds'>
): void {
  if (market === 'ML') {
    if (side === 'home') row.home_odds = price;
    if (side === 'draw') row.draw_odds = price;
    if (side === 'away') row.away_odds = price;
    return;
  }
  if (market === 'AH') {
    if (side === 'home') row.home_odds = price;
    if (side === 'away') row.away_odds = price;
    return;
  }
  if (market === 'OU') {
    if (side === 'over') row.over_odds = price;
    if (side === 'under') row.under_odds = price;
    return;
  }
  if (market === 'BTTS') {
    if (side === 'yes') row.yes_odds = price;
    if (side === 'no') row.no_odds = price;
  }
}

export function buildHistoricalOddsRows(input: BuildOddsRowsInput): {
  rows: HistoricalOddsRow[];
  rejections: OddsRowRejection[];
  partialBooks: PartialBook[];
} {
  const { set } = input;
  const rows: HistoricalOddsRow[] = [];
  const rejections: OddsRowRejection[] = [];
  const partialBooks: PartialBook[] = [];

  if (set.status === 'UNSUPPORTED_MARKET') {
    rejections.push({ marketId: set.marketId, market: set.market, reason: 'UNSUPPORTED_MARKET' });
    return { rows, rejections, partialBooks };
  }
  if (set.status === 'MISSING_LINE') {
    rejections.push({ marketId: set.marketId, market: set.market, reason: 'LINE_MISSING' });
    return { rows, rejections, partialBooks };
  }
  if (set.status === 'NO_VALID_OBSERVATIONS' || set.market === null) {
    rejections.push({ marketId: set.marketId, market: set.market, reason: 'NO_VALID_OBSERVATIONS' });
    return { rows, rejections, partialBooks };
  }

  for (const selection of set.selections) {
    if (selection.entryAfterClosing) {
      rejections.push({ marketId: set.marketId, market: set.market, reason: `ENTRY_AFTER_CLOSING:${selection.side}` });
    }
  }

  for (const observation of OBSERVATIONS) {
    const row: HistoricalOddsRow = {
      odds_id: '',
      canonical_id: input.canonicalId,
      league_id: input.leagueId,
      cluster: input.cluster,
      season: input.season,
      match_date: input.matchDate,
      market: set.market,
      observation,
      bookmaker_source: input.bookmaker,
      line: set.market === 'AH' || set.market === 'OU' ? set.line : null,
      home_odds: null,
      draw_odds: null,
      away_odds: null,
      over_odds: null,
      under_odds: null,
      yes_odds: null,
      no_odds: null,
      source_file: `${input.provider}:${input.providerEventId}`,
      // Provider-native observations are not CSV rows; 0 = not applicable.
      // The provider market id is carried explicitly in `market_id`.
      source_row: 0,
      dataset_version: input.datasetVersion,
      ingestion_version: input.ingestionVersion,
      provider: input.provider,
      provider_event_id: input.providerEventId,
      odds_timestamp: null,
      home_odds_timestamp: null,
      away_odds_timestamp: null,
      market_id: set.marketId,
    };

    const timestamps: string[] = [];
    let sides = 0;

    for (const selection of set.selections) {
      const point = observationPoint(selection, observation);
      if (!point) continue;
      assignOdds(set.market, selection.side, point.price, row);
      timestamps.push(point.createdAt);
      // Slot semantics: home_odds_timestamp covers the first slot
      // (home / over / yes), away_odds_timestamp covers the second slot
      // (away / under / no). This mirrors the existing odds-row layout.
      if (selection.side === 'home' || selection.side === 'over' || selection.side === 'yes') {
        row.home_odds_timestamp = point.createdAt;
      }
      if (selection.side === 'away' || selection.side === 'under' || selection.side === 'no') {
        row.away_odds_timestamp = point.createdAt;
      }
      sides += 1;
    }

    if (sides === 0) {
      rejections.push({
        marketId: set.marketId,
        market: set.market,
        reason: observation === 'opening' ? 'NO_ENTRY_OBSERVATION' : 'NO_CLOSING_OBSERVATION',
      });
      continue;
    }

    row.odds_timestamp = timestamps.sort().at(-1) ?? null;
    row.odds_id = deterministicOddsId([
      row.canonical_id,
      row.market,
      row.observation,
      row.bookmaker_source,
      row.line === null ? 'null' : String(row.line),
      row.provider,
      row.provider_event_id,
      String(row.market_id),
    ]);

    const expectedSides = set.market === 'ML' ? 3 : 2;
    if (sides < expectedSides) {
      partialBooks.push({
        marketId: set.marketId,
        market: set.market,
        observation,
        sides,
        expected: expectedSides,
      });
    }

    rows.push(row);
  }

  return { rows, rejections, partialBooks };
}
