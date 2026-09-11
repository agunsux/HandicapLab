// AH YIELD ENGINE — Realized yield / ROI / risk calculator.
//
// Definitions (normalized 1-unit stake per bet):
//   Total Stake = Σ stake_i            (VOID excluded: stake returned)
//   Total P&L   = Σ pnl_i
//   ROI         = Total P&L / Total Stake        (fraction)
//   Yield %     = ROI × 100
// Hit rate is NOT ROI and is reported separately:
//   weightedHitRate = (FULL_WIN + 0.5·HALF_WIN) / (evaluated − pushes)
//   cleanHitRate    = (FULL_WIN + HALF_WIN)     / (evaluated − pushes)
//
// Uncertainty: per-bet return r_i = pnl_i / stake_i;
//   SE(ROI) = sd(r) / sqrt(n);  CI95 = ROI ± 1.96·SE.
//   P(ROI > 0) via deterministic bootstrap of mean(r).

import type {
  AhBetObservation,
  AhSide,
  AhYieldCurvePoint,
  AhYieldMetrics,
  SampleSizeStatus,
} from './ahTypes';

export function sampleSizeStatus(evaluatedBets: number): SampleSizeStatus {
  if (evaluatedBets < 30) return 'INSUFFICIENT_SAMPLE';
  if (evaluatedBets < 100) return 'LOW_SAMPLE';
  if (evaluatedBets < 300) return 'MODERATE_SAMPLE';
  return 'STRONG_SAMPLE';
}

/** Deterministic PRNG (mulberry32) so every reported uncertainty is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function stdDev(values: number[], avg = mean(values)): number {
  if (values.length < 2) return 0;
  let s = 0;
  for (const v of values) {
    const d = v - avg;
    s += d * d;
  }
  return Math.sqrt(s / (values.length - 1));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round(n: number, dp = 6): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export interface BootstrapOptions {
  iterations?: number;
  seed?: number;
}

/** P(mean return > 0) under a deterministic nonparametric bootstrap. */
export function bootstrapProbabilityOfPositiveRoi(
  perBetReturns: number[],
  options: BootstrapOptions = {}
): number | null {
  const iterations = options.iterations ?? 1000;
  const seed = options.seed ?? 0x5eed;
  const n = perBetReturns.length;
  if (n < 2) return null;
  const rand = mulberry32(seed);
  let positives = 0;
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += perBetReturns[Math.floor(rand() * n)];
    }
    if (sum / n > 0) positives += 1;
  }
  return round(positives / iterations, 6);
}

function maxDrawdown(orderedPnl: number[]): number {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const pnl of orderedPnl) {
    cumulative += pnl;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDd) maxDd = dd;
  }
  return round(maxDd, 6);
}

function longestLosingStreak(orderedPnl: number[]): number {
  let streak = 0;
  let longest = 0;
  for (const pnl of orderedPnl) {
    if (pnl < 0) {
      streak += 1;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
  }
  return longest;
}

export function computeAhYieldMetrics(
  observations: AhBetObservation[],
  options: BootstrapOptions = {}
): AhYieldMetrics {
  const evaluated = observations.filter((o) => o.settlement !== 'VOID');
  const voidBets = observations.length - evaluated.length;

  let fullWins = 0;
  let halfWins = 0;
  let pushes = 0;
  let halfLosses = 0;
  let fullLosses = 0;
  let totalStake = 0;
  let totalPnl = 0;
  let grossWin = 0;
  let grossLoss = 0;

  const perBetReturns: number[] = [];
  const oddsList: number[] = [];

  for (const o of evaluated) {
    totalStake += o.stake;
    totalPnl += o.pnl;
    perBetReturns.push(o.pnl / o.stake);
    oddsList.push(o.odds);
    if (o.pnl > 0) grossWin += o.pnl;
    else if (o.pnl < 0) grossLoss += -o.pnl;

    switch (o.settlement) {
      case 'FULL_WIN': fullWins += 1; break;
      case 'HALF_WIN': halfWins += 1; break;
      case 'PUSH': pushes += 1; break;
      case 'HALF_LOSS': halfLosses += 1; break;
      case 'FULL_LOSS': fullLosses += 1; break;
    }
  }

  const n = evaluated.length;
  const nonPush = n - pushes;
  const weightedWins = fullWins + 0.5 * halfWins;
  const decisionBets = fullWins + halfWins + halfLosses + fullLosses;

  const roi = totalStake > 0 ? totalPnl / totalStake : 0;
  const sd = stdDev(perBetReturns);
  const se = n > 0 ? sd / Math.sqrt(n) : 0;
  const avgReturn = mean(perBetReturns);

  const dates = evaluated.map((o) => o.matchDate).filter(Boolean).sort();
  const leagues = new Set(evaluated.map((o) => o.leagueId));
  const matchIds = new Set(evaluated.map((o) => o.canonicalMatchId));

  const sortedByTime = [...evaluated].sort(
    (a, b) => a.matchDate.localeCompare(b.matchDate) || a.canonicalMatchId.localeCompare(b.canonicalMatchId)
  );

  const line = observations.length > 0 ? observations[0].marketLineHome : 0;
  const side: AhSide = observations.length > 0 ? observations[0].side : 'home';

  return {
    line,
    side,
    bets: observations.length,
    evaluatedBets: n,
    fullWins,
    halfWins,
    pushes,
    halfLosses,
    fullLosses,
    voidBets,
    weightedHitRate: nonPush > 0 ? round(weightedWins / nonPush, 6) : 0,
    cleanHitRate: nonPush > 0 ? round((fullWins + halfWins) / nonPush, 6) : 0,
    profitProbability: decisionBets > 0 ? round((fullWins + halfWins) / decisionBets, 6) : 0,
    totalStake: round(totalStake, 6),
    totalPnl: round(totalPnl, 6),
    roi: round(roi, 6),
    yieldPct: round(roi * 100, 4),
    roiStdError: round(se, 6),
    roiCi95: [round(roi - 1.96 * se, 6), round(roi + 1.96 * se, 6)],
    probabilityOfPositiveRoi: bootstrapProbabilityOfPositiveRoi(perBetReturns, options) ?? 0,
    averageOdds: oddsList.length > 0 ? round(mean(oddsList), 4) : 0,
    medianOdds: round(median(oddsList), 4),
    minOdds: oddsList.length > 0 ? Math.min(...oddsList) : 0,
    maxOdds: oddsList.length > 0 ? Math.max(...oddsList) : 0,
    sampleStart: dates[0] ?? '',
    sampleEnd: dates[dates.length - 1] ?? '',
    leagueCount: leagues.size,
    matchCount: matchIds.size,
    sampleSizeStatus: sampleSizeStatus(n),
    maxDrawdown: maxDrawdown(sortedByTime.map((o) => o.pnl)),
    longestLosingStreak: longestLosingStreak(sortedByTime.map((o) => o.pnl)),
    returnStdDev: round(sd, 6),
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss, 4) : null,
    sharpeLike: n >= 2 && sd > 0 ? round(avgReturn / sd, 4) : null,
  };
}

export function computeAhYieldCurve(observations: AhBetObservation[]): AhYieldCurvePoint[] {
  const ordered = [...observations]
    .filter((o) => o.settlement !== 'VOID')
    .sort(
      (a, b) =>
        a.matchDate.localeCompare(b.matchDate) ||
        a.canonicalMatchId.localeCompare(b.canonicalMatchId) ||
        a.observationId.localeCompare(b.observationId)
    );

  const points: AhYieldCurvePoint[] = [];
  let pnl = 0;
  let stake = 0;
  for (let i = 0; i < ordered.length; i++) {
    pnl += ordered[i].pnl;
    stake += ordered[i].stake;
    points.push({
      matchDate: ordered[i].matchDate,
      betsCumulative: i + 1,
      pnlCumulative: round(pnl, 6),
      stakeCumulative: round(stake, 6),
      roiCumulative: stake > 0 ? round((pnl / stake) * 100, 4) : 0,
    });
  }
  return points;
}

/**
 * Sample-size protected ranking. Raw ROI alone must never rank a 2-bet sample
 * above a 500-bet sample, so the default score is the lower bound of the 95%
 * ROI confidence interval, and INSUFFICIENT_SAMPLE groups are never eligible.
 */
export function ahValueScore(metrics: RankableAhMetrics): number {
  if (metrics.sampleSizeStatus === 'INSUFFICIENT_SAMPLE') return Number.NEGATIVE_INFINITY;
  return metrics.roiCi95[0];
}

export type AhRankMode = 'value' | 'roi' | 'ev' | 'probability' | 'sample';

/** Structural subset shared by AhYieldMetrics and AhValueRow. */
export interface RankableAhMetrics {
  evaluatedBets: number;
  roi: number;
  roiCi95: [number, number];
  profitProbability: number;
  sampleSizeStatus: SampleSizeStatus;
}

export function rankAhMetrics<T extends RankableAhMetrics>(
  rows: T[],
  mode: AhRankMode = 'value',
  evByKey?: (row: T) => number
): T[] {
  const eligible = rows.filter((r) => r.evaluatedBets >= 1);
  const sorted = [...eligible];
  switch (mode) {
    case 'value':
      sorted.sort((a, b) => ahValueScore(b) - ahValueScore(a) || b.evaluatedBets - a.evaluatedBets);
      break;
    case 'roi':
      sorted.sort((a, b) => b.roi - a.roi || b.evaluatedBets - a.evaluatedBets);
      break;
    case 'ev':
      sorted.sort((a, b) => (evByKey?.(b) ?? 0) - (evByKey?.(a) ?? 0) || b.evaluatedBets - a.evaluatedBets);
      break;
    case 'probability':
      sorted.sort((a, b) => b.profitProbability - a.profitProbability || b.evaluatedBets - a.evaluatedBets);
      break;
    case 'sample':
      sorted.sort((a, b) => b.evaluatedBets - a.evaluatedBets);
      break;
  }
  return sorted;
}
