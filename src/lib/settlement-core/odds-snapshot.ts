// ============================================================================
// ODDS SNAPSHOT ENGINE  (Epic 31A — Section B)
// ============================================================================
// The odds_snapshots table is append-only: every odds change is a NEW row, never
// updated or deleted (see migration 002). Opening / Latest / Closing are therefore
// DERIVED from the immutable history, never stored as mutable state:
//   - Opening : first captured row for (provider, market, line, fixture)
//   - Latest  : most recent captured row
//   - Closing : most recent row at/before match kickoff (or latest if unknown)
// This keeps the audit chain intact and makes every snapshot reproducible.
// ============================================================================

import type { MarketType, Selection } from './types';

export interface OddsSnapshotRow {
  provider: string;
  fixtureId: string;
  market: MarketType;
  line: number;
  selection: Selection;
  odds: number;
  capturedAt: Date | string;
}

export interface OddsSnapshotSeries {
  provider: string;
  fixtureId: string;
  market: MarketType;
  line: number;
  opening: OddsPricePoint | null;
  latest: OddsPricePoint | null;
  closing: OddsPricePoint | null;
}

export interface OddsPricePoint {
  selection: Selection;
  odds: number;
  capturedAt: string;
}

function toDate(v: Date | string): number {
  return new Date(v).getTime();
}

// Build a per-selection Opening/Latest/Closing series from raw snapshot rows.
// `kickoffAt` (optional) defines the closing cutoff; if omitted, closing = latest.
export function buildSnapshotSeries(
  rows: OddsSnapshotRow[],
  kickoffAt?: Date | string
): OddsSnapshotSeries[] {
  const groups = new Map<string, OddsSnapshotRow[]>();
  for (const r of rows) {
    const key = `${r.provider}|${r.fixtureId}|${r.market}|${r.line}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const cutoff = kickoffAt ? toDate(kickoffAt) : null;
  const series: OddsSnapshotSeries[] = [];

  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => toDate(a.capturedAt) - toDate(b.capturedAt));
    const [provider, fixtureId, market, lineStr] = key.split('|');
    const line = Number(lineStr);

    const opening = sorted[0];
    const latest = sorted[sorted.length - 1];
    const closingBeforeKickoff = cutoff
      ? [...sorted].reverse().find((r) => toDate(r.capturedAt) <= cutoff)
      : undefined;
    const closing = closingBeforeKickoff ?? latest;

    series.push({
      provider,
      fixtureId,
      market: market as MarketType,
      line,
      opening: point(opening),
      latest: point(latest),
      closing: point(closing),
    });
  }

  return series;
}

function point(r: OddsSnapshotRow | undefined): OddsPricePoint | null {
  if (!r) return null;
  return { selection: r.selection, odds: r.odds, capturedAt: new Date(r.capturedAt).toISOString() };
}

// Conviction helper: how much the price moved from opening to closing.
export function priceMovement(series: OddsSnapshotSeries): number | null {
  if (!series.opening || !series.closing) return null;
  return Number((series.closing.odds - series.opening.odds).toFixed(4));
}
