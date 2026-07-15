// ============================================================================
// PERFORMANCE LEDGER  (Epic 31A — Section E)
// ============================================================================
// Raw, reproducible performance metrics. Every value is derived purely from the
// supplied settled-bet rows — no caching, no hardcoded baselines. Each generated
// row is labelled with sample_size, date_range and a confidence_note so callers
// never mistake a small sample for a settled conclusion.
//
// Metrics:
//   - profitLossUnits : sum of profitUnits over non-void bets
//   - roi / yield     : profitLossUnits / totalStake * 100
//   - clv             : mean(impliedProbClosing - impliedProbTaken) * 100
//                       (positive => model beat the closing line; null if no
//                        closing odds available)
//   - avgOdds         : mean taken odds (non-void)
//   - avgEdge         : mean model edge fraction (non-void)
//   - strikeRate      : % of non-void bets with profitUnits > 0
//   - maxDrawdown      : max peak-to-trough drop in cumulative units (chronological)
// ============================================================================

import type { PerformanceLedgerInput, PerformanceLedgerRow } from './types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Number(n.toFixed(4));
}

export function computePerformanceLedger(
  bets: PerformanceLedgerInput[]
): PerformanceLedgerRow {
  const settled = bets.filter((b) => !b.voided);

  const sampleSize = settled.length;

  const totalStake = settled.reduce((s, b) => s + b.stakeUnits, 0);
  const profitLossUnits = round4(settled.reduce((s, b) => s + b.profitUnits, 0));

  const roi = totalStake > 0 ? round2((profitLossUnits / totalStake) * 100) : 0;
  const yieldPct = roi; // for unit-stake betting, ROI == Yield

  const wins = settled.filter((b) => b.profitUnits > 0).length;
  const strikeRate = sampleSize > 0 ? round2((wins / sampleSize) * 100) : 0;

  const avgOdds =
    sampleSize > 0
      ? round4(settled.reduce((s, b) => s + b.oddsTaken, 0) / sampleSize)
      : null;
  const avgEdge =
    sampleSize > 0
      ? round4(settled.reduce((s, b) => s + b.edge, 0) / sampleSize)
      : null;

  // CLV: only where closing odds are present.
  const clvBets = settled.filter((b) => b.closingOdds && b.closingOdds > 1);
  const clv =
    clvBets.length > 0
      ? round2(
          (clvBets.reduce(
            (s, b) => s + (1 / b.closingOdds! - 1 / b.oddsTaken),
            0
          ) /
            clvBets.length) *
            100
        )
      : null;

  const maxDrawdown = computeMaxDrawdown(settled);

  const dates = settled
    .map((b) => new Date(b.settledAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  const dateRange = {
    start: dates.length ? new Date(dates[0]).toISOString() : '',
    end: dates.length ? new Date(dates[dates.length - 1]).toISOString() : '',
  };

  return {
    roi,
    yield: yieldPct,
    clv,
    profitLossUnits,
    avgOdds,
    avgEdge,
    strikeRate,
    maxDrawdown: round2(maxDrawdown),
    sampleSize,
    dateRange,
    confidenceNote: confidenceNote(sampleSize),
  };
}

// Max peak-to-trough decline in the cumulative P/L series (units).
export function computeMaxDrawdown(
  orderedBets: PerformanceLedgerInput[]
): number {
  const sorted = [...orderedBets]
    .filter((b) => !b.voided)
    .sort((a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime());

  let peak = 0;
  let cumulative = 0;
  let maxDd = 0;
  for (const b of sorted) {
    cumulative += b.profitUnits;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function confidenceNote(n: number): string {
  if (n < 30) return 'sample size below 30, illustrative only';
  if (n < 100) return 'sample size below 100, directional only';
  return 'sufficient sample';
}
