// Evaluation Engine — Reuses Existing Research Metrics
// No metric rewriting. Connects live prediction data to the validated research pipeline.

import type { SettlementRecord } from '../prediction/types';
import type { EvidenceEntry } from '../evidence/ledger';
import {
  computeMetrics,
  bootstrapMetrics,
  seasonBreakdown,
  type SettlementRow,
  type MetricsResult,
  type BootstrapResult,
  type SeasonBreakdownRow,
} from '../../research/pipeline';
import {
  computeRiskMetrics,
  regimeAnalysis,
  type RiskMetrics,
  type RegimeResult,
} from '../../research/analytics';
import { calculateECE, brierScore, logLoss } from '../../math/metrics';

export interface EvaluationWindow {
  label: string;
  /** Minimum number of days of data */
  minDays: number;
  /** Minimum number of settled predictions required */
  minPredictions: number;
}

export const DEFAULT_EVALUATION_WINDOWS: EvaluationWindow[] = [
  { label: '30d', minDays: 30, minPredictions: 50 },
  { label: '90d', minDays: 90, minPredictions: 200 },
  { label: '180d', minDays: 180, minPredictions: 500 },
];

export interface MarketBreakdown {
  marketType: string;
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  roi: number;
  avgCLV: number;
  avgEdge: number;
}

export interface EvaluationResult {
  window: string;
  totalPredictions: number;
  settledPredictions: number;
  metrics: MetricsResult;
  risk: RiskMetrics;
  regimes: RegimeResult[];
  bootstrap: BootstrapResult;
  seasonBreakdown: SeasonBreakdownRow[];
  marketBreakdown: MarketBreakdown[];
  meetsMinimum: boolean;
}

/** Convert an evidence entry (with settlement) to a SettlementRow expected by the research pipeline */
function toSettlementRow(entry: EvidenceEntry): SettlementRow | null {
  if (entry.actualOutcome === null || entry.profit === null || entry.clv === null) return null;
  const isWin = entry.actualOutcome === 1;
  return {
    predictionId: entry.predictionId,
    timestamp: entry.createdAt.toISOString(),
    season: '',    // Will be derived from fixture metadata in production
    league: '',    // Will be derived from fixture metadata
    homeTeam: '',  // Will be derived from fixture metadata
    awayTeam: '',  // Will be derived from fixture metadata
    modelProb: entry.predictionProb,
    odds: 0,       // Will be set from odds snapshot
    ev: entry.edge,
    stake: 1,
    closingOdds: 0, // Will be set from closing odds snapshot
    openingOdds: 0, // Will be set from opening odds snapshot
    side: 'home',
    actual: isWin ? 'home' : 'away',
    isWin,
    profit: entry.profit,
    roi: entry.profit,
    clv: entry.clv,
    brierScore: brierScore(entry.predictionProb, isWin ? 1 : 0),
    logLoss: logLoss(entry.predictionProb, isWin ? 1 : 0),
  };
}

/** Compute market breakdown from evidence entries */
function computeMarketBreakdown(entries: EvidenceEntry[]): MarketBreakdown[] {
  const byType = new Map<string, EvidenceEntry[]>();
  for (const e of entries) {
    if (e.actualOutcome === null) continue;
    const type = e.marketType || 'unknown';
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(e);
  }
  return Array.from(byType.entries()).map(([marketType, evs]) => {
    const wins = evs.filter(e => e.actualOutcome === 1).length;
    const pushes = evs.filter(e => e.actualOutcome === 0.5).length;
    const losses = evs.length - wins - pushes;
    const totalProfit = evs.reduce((s, e) => s + (e.profit ?? 0), 0);
    const avgCLV = evs.reduce((s, e) => s + (e.clv ?? 0), 0) / evs.length;
    const avgEdge = evs.reduce((s, e) => s + e.edge, 0) / evs.length;
    return { marketType, totalBets: evs.length, wins, losses, pushes, roi: totalProfit / evs.length, avgCLV, avgEdge };
  }).sort((a, b) => b.totalBets - a.totalBets);
}
/**
 * Reuses: computeMetrics, bootstrapMetrics, computeRiskMetrics, regimeAnalysis from the research layer.
 */
export function evaluateEvidence(
  entries: EvidenceEntry[],
  label: string,
  minPredictions: number
): EvaluationResult {
  const validRows: SettlementRow[] = entries
    .map(toSettlementRow)
    .filter((r): r is SettlementRow => r !== null);

  const totalPredictions = entries.length;
  const settledPredictions = validRows.length;
  const meetsMinimum = settledPredictions >= minPredictions;

  if (!meetsMinimum || settledPredictions === 0) {
    return {
      window: label,
      totalPredictions,
      settledPredictions,
      metrics: computeMetrics([]),
      risk: computeRiskMetrics([]),
      regimes: [],
      bootstrap: bootstrapMetrics([]),
      seasonBreakdown: [],
      marketBreakdown: [],
      meetsMinimum,
    };
  }

  const settledEntries = entries.filter(e => e.actualOutcome !== null);

  return {
    window: label,
    totalPredictions,
    settledPredictions,
    metrics: computeMetrics(validRows),
    risk: computeRiskMetrics(validRows),
    regimes: regimeAnalysis(validRows),
    bootstrap: bootstrapMetrics(validRows),
    seasonBreakdown: seasonBreakdown(validRows),
    marketBreakdown: computeMarketBreakdown(settledEntries),
    meetsMinimum,
  };
}

/** Evaluate across multiple time windows. */
export function evaluateWindows(
  entries: EvidenceEntry[],
  windows: EvaluationWindow[] = DEFAULT_EVALUATION_WINDOWS
): EvaluationResult[] {
  const now = new Date();
  return windows.map(w => {
    const cutoff = new Date(now.getTime() - w.minDays * 24 * 60 * 60 * 1000);
    const windowEntries = entries.filter(e => e.createdAt >= cutoff);
    return evaluateEvidence(windowEntries, w.label, w.minPredictions);
  });
}
