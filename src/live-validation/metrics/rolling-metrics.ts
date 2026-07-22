// EPIC 35.5 — Rolling Performance Engine
// Recomputes rolling metrics (7/30/90/365 days) from immutable snapshots
// and settlements. Pure calculation — no side effects on predictions.

import * as crypto from 'crypto';
import { brierScore as binaryBrier, logLoss as binaryLogLoss } from '../../lib/math/metrics';
import type {
  BreakdownMetrics,
  PredictionSnapshotRecord,
  RollingMetricsRecord,
  RollingWindowDays,
  SettlementRecordLV,
} from '../types';
import { ROLLING_WINDOWS } from '../types';
import type { LiveValidationStore } from '../store/types';
import type { Clock } from '../scheduler/prediction-scheduler';

// ─── Pure metric helpers ────────────────────────────────────────────────

export function computeMaxDrawdown(profits: number[]): number {
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const p of profits) {
    equity += p;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return Number(maxDrawdown.toFixed(4));
}

export function computeSharpe(returns: number[]): number | null {
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return Number((mean / std).toFixed(4));
}

/** Kelly efficiency: realized ROI relative to the EV the model expected.
 *  1.0 = performance exactly matched expectation; <0 = losing on +EV bets. */
export function computeKellyEfficiency(
  settlements: SettlementRecordLV[],
  predictionEvByKey: Map<string, number>
): number | null {
  let expected = 0;
  let realized = 0;
  let n = 0;
  for (const s of settlements) {
    const ev = predictionEvByKey.get(`${s.predictionId}:${s.market}`);
    if (ev === undefined || ev <= 0) continue;
    expected += ev;
    realized += s.roi;
    n++;
  }
  if (n === 0 || expected === 0) return null;
  return Number((realized / expected).toFixed(4));
}

/** Multiclass Brier for 1X2: sum over classes of (p - y)^2. */
export function multiclassBrier(
  probs: { home: number; draw: number; away: number },
  actual: 'home' | 'draw' | 'away'
): number {
  return (
    (probs.home - (actual === 'home' ? 1 : 0)) ** 2 +
    (probs.draw - (actual === 'draw' ? 1 : 0)) ** 2 +
    (probs.away - (actual === 'away' ? 1 : 0)) ** 2
  );
}

function outcomeFromScore(home: number, away: number): 'home' | 'draw' | 'away' {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

function emptyBreakdown(): {
  bets: number;
  profit: number;
  wins: number;
  oddsSum: number;
  clvSum: number;
  clvCount: number;
  staked: number;
} {
  return { bets: 0, profit: 0, wins: 0, oddsSum: 0, clvSum: 0, clvCount: 0, staked: 0 };
}

function finalizeBreakdown(acc: ReturnType<typeof emptyBreakdown>): BreakdownMetrics {
  return {
    bets: acc.bets,
    roi: acc.staked > 0 ? Number((acc.profit / acc.staked).toFixed(4)) : 0,
    hitRate: acc.bets > 0 ? Number((acc.wins / acc.bets).toFixed(4)) : 0,
    profit: Number(acc.profit.toFixed(4)),
    avgOdds: acc.bets > 0 ? Number((acc.oddsSum / acc.bets).toFixed(4)) : 0,
    avgClv: acc.clvCount > 0 ? Number((acc.clvSum / acc.clvCount).toFixed(4)) : null,
  };
}

export function confidenceBucket(confidence: number): string {
  if (confidence >= 0.8) return 'HIGH';
  if (confidence >= 0.6) return 'MEDIUM';
  return 'LOW';
}

// ─── Window computation ─────────────────────────────────────────────────

export function computeWindowMetrics(
  predictions: PredictionSnapshotRecord[],
  settlements: SettlementRecordLV[],
  windowDays: RollingWindowDays,
  asOf: string,
  meta: { schemaVersion: string; correlationId: string; idFactory?: () => string }
): RollingMetricsRecord {
  const windowStart = new Date(
    new Date(asOf).getTime() - windowDays * 86_400_000
  ).toISOString();

  const preds = predictions.filter(
    p => p.model.predictionTimestamp >= windowStart && p.model.predictionTimestamp <= asOf
  );
  const setts = settlements.filter(s => s.settledAt >= windowStart && s.settledAt <= asOf);

  const predById = new Map(predictions.map(p => [p.id, p]));
  const evByKey = new Map<string, number>();
  for (const p of predictions) {
    for (const rec of [p.prediction.asianHandicap, p.prediction.overUnder, p.prediction.moneyline]) {
      if (rec) evByKey.set(`${p.id}:${rec.market}`, rec.expectedValue);
    }
  }

  // Betting accounting
  let totalProfit = 0;
  let totalStaked = 0;
  let wins = 0;
  let oddsSum = 0;
  let clvSum = 0;
  let clvCount = 0;
  const profits: number[] = [];
  const returns: number[] = [];

  const leagueAcc: Record<string, ReturnType<typeof emptyBreakdown>> = {};
  const marketAcc: Record<string, ReturnType<typeof emptyBreakdown>> = {};
  const confidenceAcc: Record<string, ReturnType<typeof emptyBreakdown>> = {};

  for (const s of setts) {
    totalProfit += s.profit;
    totalStaked += s.stake;
    if (s.outcome === 'win' || s.outcome === 'half_win') wins++;
    oddsSum += s.oddsTaken;
    if (s.clv !== null) {
      clvSum += s.clv;
      clvCount++;
    }
    profits.push(s.profit);
    returns.push(s.roi);

    const pred = predById.get(s.predictionId);
    const confKey = pred ? confidenceBucket(pred.prediction.confidence) : 'LOW';
    for (const [acc, key] of [
      [leagueAcc, s.league],
      [marketAcc, s.market],
      [confidenceAcc, confKey],
    ] as const) {
      if (!acc[key]) acc[key] = emptyBreakdown();
      const bucket = acc[key];
      bucket.bets++;
      bucket.profit += s.profit;
      bucket.staked += s.stake;
      if (s.outcome === 'win' || s.outcome === 'half_win') bucket.wins++;
      bucket.oddsSum += s.oddsTaken;
      if (s.clv !== null) {
        bucket.clvSum += s.clv;
        bucket.clvCount++;
      }
    }
  }

  // Probability quality on settled fixtures (1X2 head)
  let brierSum = 0;
  let brierCount = 0;
  let logLossSum = 0;
  let xgErrorSum = 0;
  let xgErrorCount = 0;
  const calibrationSamples: Array<{ probability: number; actual: number }> = [];

  const settledFixtures = new Map<string, SettlementRecordLV>();
  for (const s of setts) settledFixtures.set(s.fixtureId, s);

  for (const p of preds) {
    const settled = settledFixtures.get(p.fixture.fixtureId);
    if (!settled) continue;
    const actual = outcomeFromScore(settled.homeScore, settled.awayScore);
    const probs = {
      home: p.prediction.homeProb,
      draw: p.prediction.drawProb,
      away: p.prediction.awayProb,
    };
    brierSum += multiclassBrier(probs, actual);
    brierCount++;
    logLossSum += binaryLogLoss(probs[actual], 1);

    const predictedTotal = p.prediction.expectedGoalsHome + p.prediction.expectedGoalsAway;
    const actualTotal = settled.homeScore + settled.awayScore;
    xgErrorSum += Math.abs(predictedTotal - actualTotal);
    xgErrorCount++;

    calibrationSamples.push({ probability: probs.home, actual: actual === 'home' ? 1 : 0 });
  }

  // Simple ECE over home-win probability for the window summary
  let calibrationError: number | null = null;
  if (calibrationSamples.length > 0) {
    const buckets = new Array(10).fill(0).map(() => ({ pSum: 0, aSum: 0, n: 0 }));
    for (const s of calibrationSamples) {
      const idx = Math.min(9, Math.floor(s.probability * 10));
      buckets[idx].pSum += s.probability;
      buckets[idx].aSum += s.actual;
      buckets[idx].n++;
    }
    let ece = 0;
    for (const b of buckets) {
      if (b.n === 0) continue;
      ece += (b.n / calibrationSamples.length) * Math.abs(b.pSum / b.n - b.aSum / b.n);
    }
    calibrationError = Number(ece.toFixed(4));
  }

  // Edge distribution over predictions in window
  const edgeBuckets: Record<string, number> = {};
  for (const p of preds) {
    for (const rec of [p.prediction.asianHandicap, p.prediction.overUnder, p.prediction.moneyline]) {
      if (!rec || rec.action !== 'bet') continue;
      const lower = Math.floor(rec.edge * 20) / 20; // 5% wide buckets
      const label = `${(lower * 100).toFixed(0)}%..${((lower + 0.05) * 100).toFixed(0)}%`;
      edgeBuckets[label] = (edgeBuckets[label] ?? 0) + 1;
    }
  }

  const avgEv =
    preds.length > 0
      ? preds.reduce((a, p) => a + p.prediction.expectedValue, 0) / preds.length
      : 0;
  const avgEdge = (() => {
    let sum = 0;
    let n = 0;
    for (const p of preds) {
      for (const rec of [p.prediction.asianHandicap, p.prediction.overUnder, p.prediction.moneyline]) {
        if (rec && rec.action === 'bet') {
          sum += rec.edge;
          n++;
        }
      }
    }
    return n > 0 ? sum / n : 0;
  })();

  const idFactory = meta.idFactory ?? (() => crypto.randomUUID());

  return {
    id: idFactory(),
    asOf,
    windowDays,
    predictions: preds.length,
    settledBets: setts.length,
    roi: totalStaked > 0 ? Number((totalProfit / totalStaked).toFixed(4)) : 0,
    yield: setts.length > 0 ? Number((totalProfit / setts.length).toFixed(4)) : 0,
    hitRate: setts.length > 0 ? Number((wins / setts.length).toFixed(4)) : 0,
    avgOdds: setts.length > 0 ? Number((oddsSum / setts.length).toFixed(4)) : 0,
    avgExpectedValue: Number(avgEv.toFixed(4)),
    avgEdge: Number(avgEdge.toFixed(4)),
    avgClv: clvCount > 0 ? Number((clvSum / clvCount).toFixed(4)) : null,
    brierScore: brierCount > 0 ? Number((brierSum / brierCount).toFixed(4)) : null,
    logLoss: brierCount > 0 ? Number((logLossSum / brierCount).toFixed(4)) : null,
    expectedGoalsError:
      xgErrorCount > 0 ? Number((xgErrorSum / xgErrorCount).toFixed(4)) : null,
    maxDrawdown: computeMaxDrawdown(profits),
    sharpeRatio: computeSharpe(returns),
    kellyEfficiency: computeKellyEfficiency(setts, evByKey),
    calibrationError,
    totalProfit: Number(totalProfit.toFixed(4)),
    totalStaked: Number(totalStaked.toFixed(4)),
    edgeDistribution: Object.entries(edgeBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, count]) => ({ bucket, count })),
    leagueBreakdown: Object.fromEntries(
      Object.entries(leagueAcc).map(([k, v]) => [k, finalizeBreakdown(v)])
    ),
    marketBreakdown: Object.fromEntries(
      Object.entries(marketAcc).map(([k, v]) => [k, finalizeBreakdown(v)])
    ),
    confidenceBreakdown: Object.fromEntries(
      Object.entries(confidenceAcc).map(([k, v]) => [k, finalizeBreakdown(v)])
    ),
    createdAt: asOf,
    createdBy: 'rolling-metrics-engine',
    schemaVersion: meta.schemaVersion,
    correlationId: meta.correlationId,
  };
}

// ─── Engine ─────────────────────────────────────────────────────────────

export class RollingMetricsEngine {
  constructor(
    private deps: {
      store: LiveValidationStore;
      schemaVersion: string;
      clock?: Clock;
      idFactory?: () => string;
    }
  ) {}

  /** Recompute and append metrics for all rolling windows. */
  async run(correlationId?: string): Promise<RollingMetricsRecord[]> {
    const asOf = (this.deps.clock ? this.deps.clock() : new Date()).toISOString();
    const predictions = await this.deps.store.listPredictions();
    const settlements = await this.deps.store.listSettlements();

    const records: RollingMetricsRecord[] = [];
    for (const windowDays of ROLLING_WINDOWS) {
      const record = computeWindowMetrics(predictions, settlements, windowDays, asOf, {
        schemaVersion: this.deps.schemaVersion,
        correlationId: correlationId ?? 'rolling-metrics-run',
        idFactory: this.deps.idFactory,
      });
      await this.deps.store.appendRollingMetrics(record);
      records.push(record);
    }
    return records;
  }
}

// Re-export the binary brier for consumers that need per-bet scores
export { binaryBrier };
