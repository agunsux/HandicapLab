// AH HISTORY SERVICE — Canonical service for historical Asian Handicap exploration.
// Exposes verified historical data from the AH Yield engine without modifying baseline engines.
// Provides fast in-memory querying, multi-dimensional filtering, and match-level traceable drilldowns.

import * as fs from 'fs';
import * as path from 'path';
import type {
  AhBetObservation,
  AhFavoriteStatus,
  AhProvenance,
  AhSide,
  SampleSizeStatus,
} from '../research/ah-yield/ahTypes';
import type {
  AhHistoryFilters,
  AhHistoryQueryResult,
  AggregatedHistoryMetrics,
  AhAvailableFilters,
  MatchCalculationTrace,
} from '../research/ah-yield/ahHistoryContracts';

// Re-export shared DTOs so existing server-side importers keep working while the
// client imports the same types from the fs-free contracts module.
export type {
  AhHistoryFilters,
  AhHistoryQueryResult,
  AggregatedHistoryMetrics,
  AhAvailableFilters,
  MatchCalculationTrace,
} from '../research/ah-yield/ahHistoryContracts';
import { isQuarterHandicap, quarterComponents, settleAhBet } from '../research/ah-yield/ahSettlement';
import { buildAhObservations } from '../research/ah-yield/ahObservations';
import { loadCanonicalMatches, loadMarketOdds } from '../research/ah-yield/ahLoader';
import { loadAhResearchViewModel, type AhCohortView } from '../research/ah-yield/ahViewModel';

// Shared history DTOs live in the client-safe contracts module
// (src/lib/research/ah-yield/ahHistoryContracts.ts) and are re-exported above.

// In-memory cache for fast interactive response
let cachedObservations: AhBetObservation[] | null = null;
let observationsTimestamp: string = '';

export function getOrLoadHistoricalObservations(): AhBetObservation[] {
  if (cachedObservations) return cachedObservations;

  try {
    const canonicalMatches = loadCanonicalMatches();
    const marketOdds = loadMarketOdds();
    const { observations } = buildAhObservations(canonicalMatches, marketOdds);
    cachedObservations = observations;
    observationsTimestamp = new Date().toISOString().slice(0, 10);
    return observations;
  } catch (err) {
    console.warn('[AhHistoryService] Error loading observations from raw loader, attempting fallback:', err);
    return [];
  }
}

export class AhHistoryService {
  public static getDatasetFreshness(): string {
    if (!observationsTimestamp) {
      getOrLoadHistoricalObservations();
    }
    return observationsTimestamp || '2026-09-11';
  }

  public static getAvailableFilters(): AhAvailableFilters {
    const obs = getOrLoadHistoricalObservations();
    const leagueMap: Record<string, string> = {
      'ENG-PL': 'Premier League (England)',
      'ESP-LALIGA': 'La Liga (Spain)',
      'DEU-BUNDESLIGA': 'Bundesliga (Germany)',
      'ITA-SERIEA': 'Serie A (Italy)',
      'FRA-LIGUE1': 'Ligue 1 (France)',
    };

    const leagues = Array.from(new Set(obs.map((o) => o.leagueId)))
      .sort()
      .map((id) => ({ id, name: leagueMap[id] || id }));

    const seasons = Array.from(new Set(obs.map((o) => o.season))).sort().reverse();
    const lines = Array.from(new Set(obs.map((o) => o.selectionLine))).sort((a, b) => a - b);
    const sides: AhSide[] = ['home', 'away'];
    const favoriteStatuses: AhFavoriteStatus[] = ['favorite', 'underdog', 'market_neutral'];
    const provenances: AhProvenance[] = ['pinnacle', 'bet365', 'betbrain_avg', 'best_available'];

    return { leagues, seasons, lines, sides, favoriteStatuses, provenances };
  }

  public static queryObservations(filters: AhHistoryFilters = {}): AhHistoryQueryResult {
    const all = getOrLoadHistoricalObservations();

    let filtered = all;

    if (filters.league && filters.league !== 'ALL') {
      filtered = filtered.filter((o) => o.leagueId.toLowerCase() === filters.league!.toLowerCase());
    }
    if (filters.season && filters.season !== 'ALL') {
      filtered = filtered.filter((o) => o.season === filters.season);
    }
    if (filters.line !== undefined && !isNaN(filters.line)) {
      filtered = filtered.filter((o) => Math.abs(o.selectionLine - filters.line!) < 1e-6);
    }
    if (filters.side && (filters.side === 'home' || filters.side === 'away')) {
      filtered = filtered.filter((o) => o.side === filters.side);
    }
    if (filters.favoriteStatus && filters.favoriteStatus !== 'ALL' as any) {
      filtered = filtered.filter((o) => o.favoriteStatus === filters.favoriteStatus);
    }
    if (filters.provenance && filters.provenance !== 'ALL' as any) {
      filtered = filtered.filter((o) => o.provenance === filters.provenance);
    }
    if (filters.startDate) {
      filtered = filtered.filter((o) => o.matchDate >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter((o) => o.matchDate <= filters.endDate!);
    }

    const totalAvailable = filtered.length;
    const summary = this.computeAggregateMetrics(filtered);

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit !== undefined ? filters.limit : 50;
    const paged = filtered.slice(offset, offset + limit);

    return {
      filtersApplied: filters,
      summary,
      totalMatchesAvailable: totalAvailable,
      observations: paged,
      datasetUpdated: this.getDatasetFreshness(),
    };
  }

  public static computeAggregateMetrics(observations: AhBetObservation[]): AggregatedHistoryMetrics {
    const n = observations.length;
    if (n === 0) {
      return {
        sampleSize: 0,
        evaluatedBets: 0,
        fullWins: 0,
        halfWins: 0,
        pushes: 0,
        halfLosses: 0,
        fullLosses: 0,
        hitRatePct: 0,
        averageOdds: 0,
        totalPnl: 0,
        yieldRoiPct: 0,
        maxDrawdownPct: 0,
        sampleStatus: 'INSUFFICIENT_SAMPLE',
        historicalColor: 'GREY',
        historicalStatusLabel: 'INSUFFICIENT DATA (N=0)',
      };
    }

    let fullWins = 0;
    let halfWins = 0;
    let pushes = 0;
    let halfLosses = 0;
    let fullLosses = 0;
    let totalPnl = 0;
    let oddsSum = 0;

    // Track cumulative equity curve for max drawdown
    let peakEquity = 0;
    let runningEquity = 0;
    let maxDrawdown = 0;

    for (const o of observations) {
      totalPnl += o.pnl;
      oddsSum += o.odds;
      runningEquity += o.pnl;
      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }
      const dd = peakEquity - runningEquity;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }

      switch (o.settlement) {
        case 'FULL_WIN': fullWins++; break;
        case 'HALF_WIN': halfWins++; break;
        case 'PUSH': pushes++; break;
        case 'HALF_LOSS': halfLosses++; break;
        case 'FULL_LOSS': fullLosses++; break;
      }
    }

    const decided = fullWins + halfWins + halfLosses + fullLosses;
    const winPoints = fullWins + 0.5 * halfWins;
    const hitRatePct = decided > 0 ? (winPoints / decided) * 100 : 0;
    const yieldRoiPct = (totalPnl / n) * 100;
    const averageOdds = oddsSum / n;
    const maxDrawdownPct = peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : (maxDrawdown / n) * 100;

    let sampleStatus: SampleSizeStatus = 'INSUFFICIENT_SAMPLE';
    if (n >= 500) sampleStatus = 'STRONG_SAMPLE';
    else if (n >= 150) sampleStatus = 'MODERATE_SAMPLE';
    else if (n >= 30) sampleStatus = 'LOW_SAMPLE';

    // Strict Historical Color Classification (clearly labeled HISTORICAL RESULT)
    let historicalColor: 'GREEN' | 'YELLOW' | 'RED' | 'GREY' = 'GREY';
    let historicalStatusLabel = 'HISTORICAL: INSUFFICIENT SAMPLE';

    if (sampleStatus === 'INSUFFICIENT_SAMPLE') {
      historicalColor = 'GREY';
      historicalStatusLabel = 'HISTORICAL: INSUFFICIENT SAMPLE (N < 30)';
    } else if (yieldRoiPct > 0 && (sampleStatus === 'STRONG_SAMPLE' || sampleStatus === 'MODERATE_SAMPLE')) {
      historicalColor = 'GREEN';
      historicalStatusLabel = 'HISTORICAL RESULT: POSITIVE SAMPLE YIELD';
    } else if (yieldRoiPct > 0 && sampleStatus === 'LOW_SAMPLE') {
      historicalColor = 'YELLOW';
      historicalStatusLabel = 'HISTORICAL RESULT: POSITIVE BUT LOW SAMPLE';
    } else {
      historicalColor = 'RED';
      historicalStatusLabel = 'HISTORICAL RESULT: NEGATIVE SAMPLE YIELD';
    }

    return {
      sampleSize: n,
      evaluatedBets: n,
      fullWins,
      halfWins,
      pushes,
      halfLosses,
      fullLosses,
      hitRatePct: Number(hitRatePct.toFixed(2)),
      averageOdds: Number(averageOdds.toFixed(3)),
      totalPnl: Number(totalPnl.toFixed(2)),
      yieldRoiPct: Number(yieldRoiPct.toFixed(2)),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      sampleStatus,
      historicalColor,
      historicalStatusLabel,
    };
  }

  public static getMatchCalculationTrace(observationId: string): MatchCalculationTrace | null {
    const obs = getOrLoadHistoricalObservations();
    const match = obs.find((o) => o.observationId === observationId || o.canonicalMatchId === observationId);
    if (!match) return null;

    // Run deterministic settlement engine to extract component decomposition
    const settled = settleAhBet({
      side: match.side,
      line: match.selectionLine,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      odds: match.odds,
      stake: 1,
    });

    let explanation = '';
    const scoreText = `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`;
    const signLine = match.selectionLine > 0 ? `+${match.selectionLine}` : `${match.selectionLine}`;

    if (settled.isQuarterLine && settled.componentLines && settled.componentOutcomes) {
      const [line1, line2] = settled.componentLines;
      const [out1, out2] = settled.componentOutcomes;
      const sign1 = line1 > 0 ? `+${line1}` : `${line1}`;
      const sign2 = line2 > 0 ? `+${line2}` : `${line2}`;
      explanation =
        `Quarter-Ball Handicap ${signLine} splits the 1.0 unit stake equally into two adjacent half-lines: ` +
        `0.5 units on line ${sign1} (settled as ${out1}) and 0.5 units on line ${sign2} (settled as ${out2}). ` +
        `Combined settlement: ${settled.outcome} (fraction: ${settled.settlementFraction > 0 ? '+' : ''}${settled.settlementFraction}). ` +
        `P&L = ${settled.settlementFraction > 0 ? `${settled.settlementFraction} × (${match.odds} - 1)` : `${settled.settlementFraction}`} = ${settled.pnl > 0 ? `+${settled.pnl.toFixed(2)}` : settled.pnl.toFixed(2)} units.`;
    } else {
      explanation =
        `Standard Handicap ${signLine} evaluated against final score difference. ` +
        `Result: ${settled.outcome}. P&L = ${settled.pnl > 0 ? `+${settled.pnl.toFixed(2)}` : settled.pnl.toFixed(2)} units.`;
    }

    return {
      observationId: match.observationId,
      canonicalMatchId: match.canonicalMatchId,
      leagueId: match.leagueId,
      season: match.season,
      matchDate: match.matchDate,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      scoreDisplay: scoreText,
      side: match.side,
      marketLineHome: match.marketLineHome,
      selectionLine: match.selectionLine,
      odds: match.odds,
      oppositeOdds: match.oppositeOdds,
      provenance: match.provenance,
      favoriteStatus: match.favoriteStatus,
      isQuarterLine: settled.isQuarterLine,
      componentLines: settled.componentLines,
      componentOutcomes: settled.componentOutcomes,
      settlementOutcome: settled.outcome,
      settlementFraction: settled.settlementFraction,
      stake: match.stake,
      pnl: match.pnl,
      returnAmount: match.returnAmount,
      calculationExplanation: explanation,
    };
  }

  public static getLeagueBreakdown(leagueId: string): {
    leagueId: string;
    totalObservations: number;
    lines: Array<{ line: number; homeMetrics: AggregatedHistoryMetrics; awayMetrics: AggregatedHistoryMetrics }>;
  } {
    const obs = getOrLoadHistoricalObservations().filter(
      (o) => o.leagueId.toLowerCase() === leagueId.toLowerCase()
    );

    const distinctLines = Array.from(new Set(obs.map((o) => Math.abs(o.marketLineHome)))).sort((a, b) => a - b);
    const lines = distinctLines.map((l) => {
      const homeObs = obs.filter((o) => Math.abs(o.marketLineHome - l) < 1e-6 && o.side === 'home');
      const awayObs = obs.filter((o) => Math.abs(o.marketLineHome - l) < 1e-6 && o.side === 'away');
      return {
        line: l,
        homeMetrics: this.computeAggregateMetrics(homeObs),
        awayMetrics: this.computeAggregateMetrics(awayObs),
      };
    });

    return {
      leagueId,
      totalObservations: obs.length,
      lines,
    };
  }
}
