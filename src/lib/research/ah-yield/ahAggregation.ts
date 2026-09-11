// AH YIELD ENGINE — Aggregation: value table + breakdowns.
// Every aggregate is computed from the individual bet observations (traceable).

import type {
  AhBetObservation,
  AhFavoriteStatus,
  AhProvenance,
  AhSide,
  AhSnapshot,
} from './ahTypes';
import { assessAhBet, ahFairOdds, type AhEvAssessment } from './ahFairOdds';
import { fitAhPosterior, fitBinaryPositiveReturnPosterior } from './ahProbability';
import {
  computeAhYieldMetrics,
  sampleSizeStatus,
  type BootstrapOptions,
} from './ahYield';

export interface AhObservationFilter {
  snapshot?: AhSnapshot;
  provenance?: AhProvenance;
  leagueId?: string;
  season?: string;
  side?: AhSide;
  line?: number;
  favoriteStatus?: AhFavoriteStatus;
  dateFrom?: string;
  dateTo?: string;
}

export function filterAhObservations(
  observations: AhBetObservation[],
  filter: AhObservationFilter
): AhBetObservation[] {
  return observations.filter((o) => {
    if (filter.snapshot && o.snapshot !== filter.snapshot) return false;
    if (filter.provenance && o.provenance !== filter.provenance) return false;
    if (filter.leagueId && o.leagueId !== filter.leagueId) return false;
    if (filter.season && o.season !== filter.season) return false;
    if (filter.side && o.side !== filter.side) return false;
    if (filter.line !== undefined && o.marketLineHome !== filter.line) return false;
    if (filter.favoriteStatus && o.favoriteStatus !== filter.favoriteStatus) return false;
    if (filter.dateFrom && o.matchDate < filter.dateFrom) return false;
    if (filter.dateTo && o.matchDate > filter.dateTo) return false;
    return true;
  });
}

export interface AhValueRow {
  line: number;
  side: AhSide;
  snapshot: AhSnapshot;
  provenance: AhProvenance;
  bets: number;
  evaluatedBets: number;
  sampleSizeStatus: ReturnType<typeof sampleSizeStatus>;
  weightedHitRate: number;
  cleanHitRate: number;
  profitProbability: number;
  averageOdds: number;
  medianOdds: number;
  minOdds: number;
  maxOdds: number;
  totalStake: number;
  totalPnl: number;
  yieldPct: number;
  roi: number;
  roiCi95: [number, number];
  probabilityOfPositiveRoi: number;
  modelProbability: number;
  modelProbabilityCi95: [number, number];
  fairOdds: number | null;
  modelEvMean: number;
  marketImpliedEvMean: number | null;
  edgeMean: number | null;
  priceEdgeMean: number | null;
  maxDrawdown: number;
  longestLosingStreak: number;
  profitFactor: number | null;
  returnStdDev: number;
  sampleStart: string;
  sampleEnd: string;
  leagueCount: number;
  matchCount: number;
  eligibleForBest: boolean;
  /**
   * Engine classification — historical realized performance is kept separate
   * from model expected value:
   *  INSUFFICIENT_DATA: N < 30 (never eligible for ranking).
   *  POSITIVE_VALUE:    pooled model EV > 0 AND lower 95% ROI bound > 0.
   *  NEGATIVE_VALUE:    pooled model EV < 0 AND upper 95% ROI bound < 0.
   *  NEUTRAL:           everything else.
   */
  valueState: 'POSITIVE_VALUE' | 'NEGATIVE_VALUE' | 'NEUTRAL' | 'INSUFFICIENT_DATA';
}

export interface BuildValueTableOptions extends BootstrapOptions {
  minEvaluatedBets?: number;
}

function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function buildAhValueRows(
  groupObservations: AhBetObservation[],
  options: BuildValueTableOptions = {}
): AhValueRow[] {
  const groups = new Map<string, AhBetObservation[]>();
  for (const o of groupObservations) {
    const key = `${o.snapshot}|${o.provenance}|${o.marketLineHome}|${o.side}`;
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }

  const rows: AhValueRow[] = [];
  const minBets = options.minEvaluatedBets ?? 1;

  for (const list of groups.values()) {
    const metrics = computeAhYieldMetrics(list, options);
    if (metrics.evaluatedBets < minBets) continue;

    const posterior = fitAhPosterior(list);
    const binary = fitBinaryPositiveReturnPosterior(list);

    const evAssessments: AhEvAssessment[] = list
      .filter((o) => o.settlement !== 'VOID')
      .map((o) => assessAhBet(posterior, o.odds, o.oppositeOdds));

    const modelEvMean = meanOf(evAssessments.map((a) => a.modelEv)) ?? 0;
    const marketImpliedEvValues = evAssessments
      .map((a) => a.marketImpliedEv)
      .filter((v): v is number => v !== null);
    const edgeValues = evAssessments.map((a) => a.edge).filter((v): v is number => v !== null);
    const priceEdgeValues = evAssessments.map((a) => a.priceEdge).filter((v): v is number => v !== null);

    const first = list[0];
    const modelEvMeanRounded = Number(modelEvMean.toFixed(6));
    rows.push({
      line: first.marketLineHome,
      side: first.side,
      snapshot: first.snapshot,
      provenance: first.provenance,
      bets: metrics.bets,
      evaluatedBets: metrics.evaluatedBets,
      sampleSizeStatus: metrics.sampleSizeStatus,
      weightedHitRate: metrics.weightedHitRate,
      cleanHitRate: metrics.cleanHitRate,
      profitProbability: metrics.profitProbability,
      averageOdds: metrics.averageOdds,
      medianOdds: metrics.medianOdds,
      minOdds: metrics.minOdds,
      maxOdds: metrics.maxOdds,
      totalStake: metrics.totalStake,
      totalPnl: metrics.totalPnl,
      yieldPct: metrics.yieldPct,
      roi: metrics.roi,
      roiCi95: metrics.roiCi95,
      probabilityOfPositiveRoi: metrics.probabilityOfPositiveRoi,
      modelProbability: Number(binary.probability.toFixed(6)),
      modelProbabilityCi95: [
        Number(binary.ci95[0].toFixed(6)),
        Number(binary.ci95[1].toFixed(6)),
      ],
      fairOdds: (() => {
        const fair = ahFairOdds(posterior);
        return fair === null ? null : Number(fair.toFixed(6));
      })(),
      modelEvMean: modelEvMeanRounded,
      marketImpliedEvMean:
        marketImpliedEvValues.length > 0 ? Number((meanOf(marketImpliedEvValues) as number).toFixed(6)) : null,
      edgeMean: edgeValues.length > 0 ? Number((meanOf(edgeValues) as number).toFixed(6)) : null,
      priceEdgeMean:
        priceEdgeValues.length > 0 ? Number((meanOf(priceEdgeValues) as number).toFixed(6)) : null,
      maxDrawdown: metrics.maxDrawdown,
      longestLosingStreak: metrics.longestLosingStreak,
      profitFactor: metrics.profitFactor,
      returnStdDev: metrics.returnStdDev,
      sampleStart: metrics.sampleStart,
      sampleEnd: metrics.sampleEnd,
      leagueCount: metrics.leagueCount,
      matchCount: metrics.matchCount,
      eligibleForBest: metrics.sampleSizeStatus !== 'INSUFFICIENT_SAMPLE',
      valueState:
        metrics.sampleSizeStatus === 'INSUFFICIENT_SAMPLE'
          ? 'INSUFFICIENT_DATA'
          : modelEvMeanRounded > 0 && metrics.roiCi95[0] > 0
            ? 'POSITIVE_VALUE'
            : modelEvMeanRounded < 0 && metrics.roiCi95[1] < 0
              ? 'NEGATIVE_VALUE'
              : 'NEUTRAL',
    });
  }

  rows.sort((a, b) => a.line - b.line || a.side.localeCompare(b.side) || a.snapshot.localeCompare(b.snapshot));
  return rows;
}

export type AhBreakdownDimension =
  | 'league'
  | 'season'
  | 'side'
  | 'favoriteStatus'
  | 'snapshot'
  | 'provenance'
  | 'line';

export interface AhBreakdownRow {
  dimension: AhBreakdownDimension;
  key: string;
  evaluatedBets: number;
  totalPnl: number;
  totalStake: number;
  yieldPct: number;
  roiCi95: [number, number];
  sampleSizeStatus: ReturnType<typeof sampleSizeStatus>;
  profitProbability: number;
}

function dimensionKey(o: AhBetObservation, dimension: AhBreakdownDimension): string {
  switch (dimension) {
    case 'league': return o.leagueId;
    case 'season': return o.season;
    case 'side': return o.side;
    case 'favoriteStatus': return o.favoriteStatus;
    case 'snapshot': return o.snapshot;
    case 'provenance': return o.provenance;
    case 'line': return String(o.marketLineHome);
  }
}

export function breakdownAhMetrics(
  observations: AhBetObservation[],
  dimension: AhBreakdownDimension,
  options: BootstrapOptions = {}
): AhBreakdownRow[] {
  const groups = new Map<string, AhBetObservation[]>();
  for (const o of observations) {
    const key = dimensionKey(o, dimension);
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }

  const rows: AhBreakdownRow[] = [];
  for (const [key, list] of groups) {
    const m = computeAhYieldMetrics(list, options);
    rows.push({
      dimension,
      key,
      evaluatedBets: m.evaluatedBets,
      totalPnl: m.totalPnl,
      totalStake: m.totalStake,
      yieldPct: m.yieldPct,
      roiCi95: m.roiCi95,
      sampleSizeStatus: m.sampleSizeStatus,
      profitProbability: m.profitProbability,
    });
  }
  rows.sort((a, b) => Number(a.key) - Number(b.key) || a.key.localeCompare(b.key));
  return rows;
}
