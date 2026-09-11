// ============================================================================
// Entry / closing selection for OddsPapi historical odds
// ============================================================================
// Entry and closing are TIMESTAMP-AWARE, never "latest row by arbitrary order":
//
//   accepted window : [kickoff - windowMs, kickoff]
//   entry           : earliest valid observation inside the window
//   closing         : latest valid observation at/before kickoff
//
// If a valid closing observation does not exist → closing = null (unavailable).
// If an observation is after kickoff it is rejected and counted. Per-side
// timestamps are preserved so ML 3-way books do not lose individual times.

import type { HistoricalOddPoint } from '@/lib/data/providers/odds/native/normalize';
import {
  classifyCatalogMarket,
  outcomeSide,
  type CatalogMarket,
  type SelectionSide,
  type StorageMarket,
} from './marketCatalog';

export const DEFAULT_ENTRY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export interface SeriesPoint {
  createdAt: string;
  price: number;
  limit: number | null;
}

export interface SeriesSelectionResult {
  side: SelectionSide;
  outcomeId: number;
  entry: SeriesPoint | null;
  closing: SeriesPoint | null;
  singleObservation: boolean;
  /** Points excluded because their timestamp is invalid. */
  invalidTimestamp: number;
  /** Points excluded because they are after kickoff. */
  closingAfterKickoffRejected: number;
  /** Points excluded because they are before the accepted entry window. */
  outsideWindow: number;
  /** Sanity gate: entry must never be after closing. */
  entryAfterClosing: boolean;
}

export type MarketObservationStatus =
  | 'READY'
  | 'NO_VALID_OBSERVATIONS'
  | 'MISSING_LINE'
  | 'UNSUPPORTED_MARKET';

export interface MarketObservationSet {
  marketId: number;
  market: StorageMarket | null;
  line: number | null;
  status: MarketObservationStatus;
  selections: SeriesSelectionResult[];
}

export interface SelectionOptions {
  entryWindowMs?: number;
}

export function selectEntryClosing(
  points: SeriesPoint[],
  kickoffMs: number,
  entryWindowMs: number = DEFAULT_ENTRY_WINDOW_MS
): {
  entry: SeriesPoint | null;
  closing: SeriesPoint | null;
  invalidTimestamp: number;
  closingAfterKickoffRejected: number;
  outsideWindow: number;
} {
  let invalidTimestamp = 0;
  let closingAfterKickoffRejected = 0;
  let outsideWindow = 0;

  const valid: Array<{ point: SeriesPoint; t: number }> = [];
  for (const point of points) {
    const t = Date.parse(point.createdAt);
    if (!Number.isFinite(t)) {
      invalidTimestamp += 1;
      continue;
    }
    if (t > kickoffMs) {
      closingAfterKickoffRejected += 1;
      continue;
    }
    if (t < kickoffMs - entryWindowMs) {
      outsideWindow += 1;
      continue;
    }
    valid.push({ point, t });
  }

  if (valid.length === 0) {
    return { entry: null, closing: null, invalidTimestamp, closingAfterKickoffRejected, outsideWindow };
  }

  let earliest = valid[0];
  let latest = valid[0];
  for (const item of valid) {
    if (item.t < earliest.t) earliest = item;
    if (item.t > latest.t) latest = item;
  }

  return {
    entry: earliest.point,
    closing: latest.point,
    invalidTimestamp,
    closingAfterKickoffRejected,
    outsideWindow,
  };
}

/**
 * Build market observation sets from normalized historical points.
 * Unknown markets and unmapped outcomes are counted, never guessed.
 */
export function buildMarketObservationSets(
  points: HistoricalOddPoint[],
  catalog: Map<number, CatalogMarket>,
  kickoffMs: number,
  options: SelectionOptions = {}
): {
  sets: MarketObservationSet[];
  unsupportedMarketIds: number[];
  unmappedOutcomeCount: number;
} {
  const entryWindowMs = options.entryWindowMs ?? DEFAULT_ENTRY_WINDOW_MS;
  const byMarket = new Map<number, HistoricalOddPoint[]>();

  for (const point of points) {
    const list = byMarket.get(point.marketId) ?? [];
    list.push(point);
    byMarket.set(point.marketId, list);
  }

  const sets: MarketObservationSet[] = [];
  const unsupported = new Set<number>();
  let unmappedOutcomeCount = 0;

  for (const [marketId, marketPoints] of byMarket.entries()) {
    const catalogMarket = catalog.get(marketId);
    if (!catalogMarket) {
      unsupported.add(marketId);
      continue;
    }
    const classified = classifyCatalogMarket(catalogMarket);
    if (!classified) {
      unsupported.add(marketId);
      continue;
    }

    if ((classified.market === 'AH' || classified.market === 'OU') && classified.line === null) {
      sets.push({
        marketId,
        market: classified.market,
        line: null,
        status: 'MISSING_LINE',
        selections: [],
      });
      continue;
    }

    const byOutcome = new Map<number, SeriesPoint[]>();
    for (const point of marketPoints) {
      const list = byOutcome.get(point.outcomeId) ?? [];
      list.push({ createdAt: point.createdAt, price: point.price, limit: point.limit });
      byOutcome.set(point.outcomeId, list);
    }

    const selections: SeriesSelectionResult[] = [];
    for (const outcome of catalogMarket.outcomes) {
      const side = outcomeSide(classified.market, outcome.outcomeName);
      if (!side) {
        unmappedOutcomeCount += 1;
        continue;
      }
      const series = byOutcome.get(outcome.outcomeId) ?? [];
      const selected = selectEntryClosing(series, kickoffMs, entryWindowMs);
      const singleObservation =
        selected.entry !== null &&
        selected.closing !== null &&
        selected.entry.createdAt === selected.closing.createdAt;
      const entryAfterClosing =
        selected.entry !== null &&
        selected.closing !== null &&
        Date.parse(selected.entry.createdAt) > Date.parse(selected.closing.createdAt);

      selections.push({
        side,
        outcomeId: outcome.outcomeId,
        entry: selected.entry,
        closing: selected.closing,
        singleObservation,
        invalidTimestamp: selected.invalidTimestamp,
        closingAfterKickoffRejected: selected.closingAfterKickoffRejected,
        outsideWindow: selected.outsideWindow,
        entryAfterClosing,
      });
    }

    const hasAny = selections.some((s) => s.entry !== null || s.closing !== null);
    sets.push({
      marketId,
      market: classified.market,
      line: classified.line,
      status: hasAny ? 'READY' : 'NO_VALID_OBSERVATIONS',
      selections,
    });
  }

  return { sets, unsupportedMarketIds: [...unsupported], unmappedOutcomeCount };
}
