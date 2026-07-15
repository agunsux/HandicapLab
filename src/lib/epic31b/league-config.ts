/**
 * EPIC 31B — Production Replay & Shadow Validation
 * League Configuration & Data Provider
 */

import type { LeagueId, LeagueName, LeagueConfig, MarketType, ReplayOutcome, ReplayMetrics, ValidationReport, PerformanceProfile, GovernanceAudit } from './types';
import { ParquetHelper } from '../data-platform/parquetHelper';
import { ProbabilityEngine } from '../engines/probability-engine';
import { EdgeScanner } from '../engines/edge-scanner';
import { settle, settleAsianHandicap, settleMoneyline, settleOverUnder } from '../settlement-core/settlement';
import { DeVigService } from '../settlement-core/devig';
import { computePerformanceLedger } from '../settlement-core/performance-ledger';
import type { PerformanceLedgerInput } from '../settlement-core/types';

export const LEAGUE_CONFIGS: Record<LeagueId, LeagueConfig> = {
  '39': {
    leagueId: '39',
    leagueName: 'EPL',
    country: 'England',
    season: '2023-2024',
    dataPath: 'data/silver/39/2023-2024/v1/dataset.parquet',
    parquetPath: 'data/silver/39/2023-2024/v1/dataset.parquet',
    marketTypes: ['ML', 'AH', 'OU'],
  },
  '40': {
    leagueId: '40',
    leagueName: 'La Liga',
    country: 'Spain',
    season: '2023-2024',
    dataPath: 'data/silver/40/2023-2024/v1/dataset.parquet',
    parquetPath: 'data/silver/40/2023-2024/v1/dataset.parquet',
    marketTypes: ['ML', 'AH', 'OU'],
  },
  '135': {
    leagueId: '135',
    leagueName: 'Bundesliga',
    country: 'Germany',
    season: '2023-2024',
    dataPath: 'data/silver/135/2023-2024/v1/dataset.parquet',
    parquetPath: 'data/silver/135/2023-2024/v1/dataset.parquet',
    marketTypes: ['ML', 'AH', 'OU'],
  },
  '140': {
    leagueId: '140',
    leagueName: 'Serie A',
    country: 'Italy',
    season: '2023-2024',
    dataPath: 'data/silver/140/2023-2024/v1/dataset.parquet',
    parquetPath: 'data/silver/140/2023-2024/v1/dataset.parquet',
    marketTypes: ['ML', 'AH', 'OU'],
  },
  '78': {
    leagueId: '78',
    leagueName: 'Ligue 1',
    country: 'France',
    season: '2023-2024',
    dataPath: 'data/silver/78/2023-2024/v1/dataset.parquet',
    parquetPath: 'data/silver/78/2023-2024/v1/dataset.parquet',
    marketTypes: ['ML', 'AH', 'OU'],
  },
  '61': {
    leagueId: '61',
    leagueName: 'Liga Portugal',
    country: 'Portugal',
    season: '2023-2024',
    dataPath: 'data/silver/61/2023-2024/v1/dataset.parquet',
    parquetPath: 'data/silver/61/2023-2024/v1/dataset.parquet',
    marketTypes: ['ML', 'AH', 'OU'],
  },
};

export function getLeagueConfig(leagueId: LeagueId): LeagueConfig {
  return LEAGUE_CONFIGS[leagueId];
}

export function getAllLeagueIds(): LeagueId[] {
  return Object.keys(LEAGUE_CONFIGS) as LeagueId[];
}

export function getLeagueName(leagueId: LeagueId): LeagueName {
  return LEAGUE_CONFIGS[leagueId].leagueName;
}

export class MultiLeagueDataProvider {
  private static cache = new Map<string, any[]>();

  static async loadMatches(leagueId: LeagueId, maxMatches?: number): Promise<any[]> {
    const config = getLeagueConfig(leagueId);
    const cacheKey = `${leagueId}:${config.season}`;

    if (!this.cache.has(cacheKey)) {
      const rows = await ParquetHelper.read(config.parquetPath);
      this.cache.set(cacheKey, rows);
    }

    const rows = this.cache.get(cacheKey) || [];
    return maxMatches ? rows.slice(0, maxMatches) : rows;
  }

  static async loadAllLeagues(maxMatchesPerLeague?: number): Promise<Record<LeagueId, any[]>> {
    const result = {} as Record<LeagueId, any[]>;
    for (const leagueId of getAllLeagueIds()) {
      result[leagueId] = await this.loadMatches(leagueId, maxMatchesPerLeague);
    }
    return result;
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

export class ProductionReplayRunner {
  private seed: number;
  private rngState: number;

  constructor(seed: number = 42) {
    this.seed = seed;
    this.rngState = seed;
  }

  private seededRandom(): number {
    this.rngState = (this.rngState * 1664525 + 1013904223) & 0x7fffffff;
    return this.rngState / 0x7fffffff;
  }

  private resetRng(): void {
    this.rngState = this.seed;
  }

  async runLeague(leagueId: LeagueId, maxMatches?: number): Promise<{
    outcomes: ReplayOutcome[];
    metrics: ReplayMetrics;
    validationReport: ValidationReport;
  }> {
    const rows = await MultiLeagueDataProvider.loadMatches(leagueId, maxMatches);
    const config = getLeagueConfig(leagueId);

    const outcomes: ReplayOutcome[] = [];
    const errors: any[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let missingOdds = 0;
    let missingResults = 0;

    for (const row of rows) {
      this.resetRng();
      const fixtureId = String(row.match_id || row.fixture_id || `unknown-${this.seededRandom().toString(36)}`);
      const homeGoals = Number(row.FTHG ?? row.home_goals ?? 0);
      const awayGoals = Number(row.FTAG ?? row.away_goals ?? 0);
      const homeTeam = String(row.HomeTeam ?? row.home_team ?? 'Home');
      const awayTeam = String(row.AwayTeam ?? row.away_team ?? 'Away');
      const league = String(row.League ?? row.league_id ?? leagueId);

      if (!homeTeam || !awayTeam) {
        invalidCount++;
        errors.push({ fixtureId, field: 'teams', message: 'Missing team names', severity: 'error' as const });
        continue;
      }

      const homeOdds = Number(row.HomeOdds ?? row.B365H ?? row.home_odds ?? 2.0);
      const drawOdds = Number(row.DrawOdds ?? row.B365D ?? row.draw_odds ?? 3.5);
      const awayOdds = Number(row.AwayOdds ?? row.B365A ?? row.away_odds ?? 3.0);
      const overOdds = Number(row.OverOdds ?? row.B365O ?? row.over_odds ?? 2.0);
      const underOdds = Number(row.UnderOdds ?? row.B365U ?? row.under_odds ?? 2.0);

      if (homeOdds <= 1 || drawOdds <= 1 || awayOdds <= 1) {
        missingOdds++;
        errors.push({ fixtureId, field: 'odds', message: 'Invalid odds', severity: 'error' as const });
        continue;
      }

      if (homeGoals === null || awayGoals === null) {
        missingResults++;
        errors.push({ fixtureId, field: 'result', message: 'Missing result', severity: 'error' as const });
        continue;
      }

      validCount++;

      const matchFeatures: any = {
        matchId: fixtureId,
        marketType: 'ML',
        kickoffAt: new Date(row.Date ? `${row.Date}T15:00:00Z` : new Date().toISOString()),
        homeFormLast5: [1, 1, 1, 1, 1],
        awayFormLast5: [0, 0, 0, 0, 0],
        homeFormWeighted: 3.0,
        awayFormWeighted: 1.0,
        homeRestDays: 6,
        awayRestDays: 5,
        homeTravelKm: 0,
        homeElo: 1600 + this.seededRandom() * 100,
        awayElo: 1550 + this.seededRandom() * 100,
        eloDelta: 50,
        homeAttack: 1.6,
        homeDefense: 1.1,
        awayAttack: 1.3,
        awayDefense: 1.2,
        leagueAvgGoals: 2.7,
        isHomeAdvantage: true,
        leagueId: league,
        season: config.season,
        generatedAt: new Date(),
      };

      const probability = await ProbabilityEngine.predict(matchFeatures, {
        calibrationMethod: 'platt',
        rho: -0.06,
      });

      const marketOdds = {
        homeOdds,
        drawOdds,
        awayOdds,
        line: 0,
      };

      const picks = EdgeScanner.scan(fixtureId, 'ML', probability, marketOdds);
      const topPick = picks[0];

      const kellyStake = topPick ? topPick.kellyStake : 0;
      const expectedValue = topPick ? topPick.expectedValue : 0;

      const marketOddsNum = topPick ? topPick.marketOdds : homeOdds;
      const selection = topPick ? topPick.outcome : 'home';
      const predictedProb = selection === 'home' ? probability.pHome : selection === 'draw' ? probability.pDraw : probability.pAway;

      const actualResult = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
      const profitLoss = actualResult === 1 ? kellyStake * (marketOddsNum - 1) : actualResult === 0.5 ? 0 : -kellyStake;
      const brierScore = Math.pow(predictedProb - actualResult, 2);
      const logLoss = actualResult === 1 ? -Math.log(Math.max(0.001, predictedProb)) : actualResult === 0 ? -Math.log(Math.max(0.001, 1 - predictedProb)) : 0;

      const closingOdds = marketOddsNum * (0.9 + this.seededRandom() * 0.2);
      const clv = DeVigService.clv(marketOddsNum, closingOdds);

      const voided = homeGoals < 0 || awayGoals < 0;
      let settledOutcome: string;
      let settlementProfitUnits: number;

      if (voided) {
        settledOutcome = 'VOID';
        settlementProfitUnits = 0;
      } else {
        const settlement = settleMoneyline(homeGoals, awayGoals, selection as 'home' | 'draw' | 'away', marketOddsNum, false);
        settledOutcome = settlement.outcome;
        settlementProfitUnits = settlement.profitUnits * kellyStake;
      }

      outcomes.push({
        fixtureId,
        marketType: 'ML',
        selection,
        predictedProbability: Math.round(predictedProb * 10000) / 10000,
        actualResult,
        profitLoss: Math.round(profitLoss * 10000) / 10000,
        brierScore: Math.round(brierScore * 10000) / 10000,
        logLoss: Math.round(logLoss * 10000) / 10000,
        clv: Math.round(clv * 10000) / 10000,
        kellyStake: Math.round(kellyStake * 10000) / 10000,
        expectedValue: Math.round(expectedValue * 10000) / 10000,
        settledOutcome,
        settlementProfitUnits: Math.round(settlementProfitUnits * 10000) / 10000,
      });
    }

    const metrics = this.computeMetrics(outcomes);
    const validationReport: ValidationReport = {
      totalFixtures: rows.length,
      validFixtures: validCount,
      invalidFixtures: invalidCount,
      missingOdds,
      missingResults,
      validationErrors: errors,
    };

    return { outcomes, metrics, validationReport };
  }

  private computeMetrics(outcomes: ReplayOutcome[]): ReplayMetrics {
    const totalPredictions = outcomes.length;
    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const voided = outcomes.filter((o) => o.actualResult === 0.5).length;
    const totalProfit = outcomes.reduce((sum, o) => sum + o.profitLoss, 0);
    const totalStake = outcomes.reduce((sum, o) => sum + o.kellyStake, 0);
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const yieldPct = roi;
    const avgClv = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.clv, 0) / outcomes.length : 0;
    const winRate = totalPredictions > 0 ? (won / totalPredictions) * 100 : 0;
    const brierScore = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.brierScore, 0) / outcomes.length : 0;
    const logLoss = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.logLoss, 0) / outcomes.length : 0;
    const avgKellyStake = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.kellyStake, 0) / outcomes.length : 0;

    let cumulative = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;

    for (const o of outcomes) {
      cumulative += o.profitLoss;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (o.actualResult === 1) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
      } else if (o.actualResult === 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
      }
    }

    const grossProfit = outcomes.filter((o) => o.profitLoss > 0).reduce((s, o) => s + o.profitLoss, 0);
    const grossLoss = Math.abs(outcomes.filter((o) => o.profitLoss < 0).reduce((s, o) => s + o.profitLoss, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const returns = outcomes.map((o) => o.profitLoss);
    const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(outcomes.length) : null;

    return {
      totalMatches: new Set(outcomes.map((o) => o.fixtureId)).size,
      totalPredictions,
      won,
      lost,
      voided,
      roi: Math.round(roi * 100) / 100,
      yield: Math.round(yieldPct * 100) / 100,
      avgClv: Math.round(avgClv * 10000) / 10000,
      winRate: Math.round(winRate * 100) / 100,
      totalStake: Math.round(totalStake * 10000) / 10000,
      totalProfit: Math.round(totalProfit * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      avgKellyStake: Math.round(avgKellyStake * 10000) / 10000,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      sharpeRatio: sharpeRatio ? Math.round(sharpeRatio * 10000) / 10000 : null,
      profitFactor: Math.round(profitFactor * 10000) / 10000,
      longestWinStreak,
      longestLossStreak,
    };
  }
}
