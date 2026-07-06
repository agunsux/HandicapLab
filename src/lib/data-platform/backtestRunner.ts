// HandicapLab Live Data Platform - Replay Backtester
// Location: src/lib/data-platform/backtestRunner.ts

import { TimeTravelSnapshot } from './timeTravel';
import { EnsembleEngine, EnsemblePrediction } from '../engines/decision-engine-v1/ensemble-engine';
import { ModelRegistry } from '../engines/decision-engine-v1/registry';
import { EloRatingModel } from '../engines/decision-engine-v1/models/elo-rating';
import { PoissonModelWrapper } from '../engines/decision-engine-v1/models/poisson-wrapper';
import { XGModel } from '../engines/decision-engine-v1/models/xg-model';
import { LogisticRegressionModel } from '../engines/decision-engine-v1/models/logistic-regression';
import { DixonColesModelWrapper } from '../engines/decision-engine-v1/models/dixon-coles-wrapper';
import { MatchFeatures } from '../engines/feature-engine/types';
import { CanonicalFixture, CanonicalOdds } from './canonicalModel';
import { CalibrationEngine } from './calibration';

export interface BacktestMetrics {
  totalMatches: number;
  totalBetsPlaced: number;
  winCount: number;
  hitRate: number;
  initialBankroll: number;
  finalBankroll: number;
  roi: number;
  yield: number;
  brierScore: number;
  logLoss: number;
  averageCLV: number;
  maxDrawdown: number;
  kellyGrowth: number;
  sharpeRatio: number;
  averageEdge: number;
  ece: number;
  mce: number;
}

export class BacktestRunner {
  /**
   * Initializes and registers the frozen prediction models.
   */
  public static initModels(): void {
    ModelRegistry.clear();
    ModelRegistry.register('elo', new EloRatingModel());
    ModelRegistry.register('poisson', new PoissonModelWrapper());
    ModelRegistry.register('xg', new XGModel());
    ModelRegistry.register('logistic', new LogisticRegressionModel());
    ModelRegistry.register('dixonColes', new DixonColesModelWrapper());
    
    // Set standard weight configuration (Poisson, DC, Elo, Logistic, xG equal weight)
    EnsembleEngine.setWeights({
      poisson: 0.20,
      dixonColes: 0.20,
      elo: 0.20,
      logistic: 0.20,
      xg: 0.20
    });
  }

  /**
   * Runs the backtest replay over a chronological set of fixtures.
   */
  public static async run(
    fixtures: CanonicalFixture[],
    oddsOpen: CanonicalOdds[],
    oddsClose: CanonicalOdds[],
    goldDir?: string
  ): Promise<BacktestMetrics> {
    TimeTravelSnapshot.clearCache();
    this.initModels();

    const initialBankroll = 10000;
    let bankrollFlat = initialBankroll;
    let bankrollKelly = initialBankroll;
    let peakKelly = initialBankroll;

    let totalStakedFlat = 0;
    let totalReturnedFlat = 0;
    let totalStakedKelly = 0;
    let totalReturnedKelly = 0;

    let winCount = 0;
    let betsPlaced = 0;
    let maxDrawdownKelly = 0;
    
    const dailyReturns: number[] = [];
    const clvValues: number[] = [];
    const edgeValues: number[] = [];

    // For ECE/MCE/Brier/LogLoss stats
    let brierSum = 0;
    let logLossSum = 0;
    const predictionsList: { probability: number; outcome: number }[] = [];

    // Filter fixtures to simulate: skip first 100 matches to allow rolling stats initialization
    const startIdx = Math.min(100, fixtures.length);
    const testFixtures = fixtures.slice(startIdx);

    for (const match of testFixtures) {
      const kickoffDate = new Date(match.kickoffTime);
      const snapshot = new TimeTravelSnapshot(kickoffDate, goldDir);

      const homeElo = snapshot.getElo(match.homeTeam.name);
      const awayElo = snapshot.getElo(match.awayTeam.name);
      
      const homeStats = snapshot.getTeamStatsHistory(match.homeTeam.name);
      const awayStats = snapshot.getTeamStatsHistory(match.awayTeam.name);

      // Compute simple rolling features
      const getAvgScored = (stats: any[]) =>
        stats.length > 0 ? stats.reduce((sum, s) => sum + s.shotsOnTarget, 0) / stats.length / 5 : 1.3;
      const getAvgConceded = (stats: any[]) =>
        stats.length > 0 ? stats.reduce((sum, s) => sum + s.fouls, 0) / stats.length / 10 : 1.3;

      const features: MatchFeatures = {
        matchId: match.id,
        marketType: 'ML',
        kickoffAt: kickoffDate,
        homeFormLast5: [1, 1, 1, 1, 1],
        awayFormLast5: [1, 1, 1, 1, 1],
        homeFormWeighted: 1.0,
        awayFormWeighted: 1.0,
        homeRestDays: 4,
        awayRestDays: 4,
        homeTravelKm: 0,
        homeElo,
        awayElo,
        eloDelta: homeElo - awayElo,
        homeAttack: getAvgScored(homeStats),
        homeDefense: getAvgConceded(homeStats),
        awayAttack: getAvgScored(awayStats),
        awayDefense: getAvgConceded(awayStats),
        leagueAvgGoals: 2.82,
        isHomeAdvantage: true,
        leagueId: '39',
        season: '2024-2025',
        generatedAt: new Date(kickoffDate.getTime() - 3600 * 1000)
      };

      // Get predictions
      let pred: EnsemblePrediction;
      try {
        pred = await EnsembleEngine.predict(features);
      } catch (err) {
        continue;
      }

      const actualHomeWin =
        match.fullTimeHomeGoals !== undefined &&
        match.fullTimeHomeGoals !== null &&
        match.fullTimeAwayGoals !== undefined &&
        match.fullTimeAwayGoals !== null &&
        match.fullTimeHomeGoals > match.fullTimeAwayGoals
          ? 1
          : 0;

      brierSum += Math.pow(pred.pHome - actualHomeWin, 2);
      const pClamped = Math.max(0.0001, Math.min(0.9999, pred.pHome));
      logLossSum += actualHomeWin === 1 ? -Math.log(pClamped) : -Math.log(1 - pClamped);

      predictionsList.push({ probability: pred.pHome, outcome: actualHomeWin });

      // Get opening and closing odds for home ML selection
      const matchOpen = oddsOpen.find((o) => o.fixtureId === match.id && o.marketType === 'ML' && o.selection === 'home');
      const matchClose = oddsClose.find((o) => o.fixtureId === match.id && o.marketType === 'ML' && o.selection === 'home');

      if (!matchClose || !matchOpen) continue;

      const oddsCloseHome = matchClose.oddsDecimal;
      const oddsOpenHome = matchOpen.oddsDecimal;

      // Calculate Expected Edge
      const ev = pred.pHome * oddsCloseHome - 1.0;

      // If EV edge exceeds +2.0%, execute simulated bets
      if (ev >= 0.02) {
        betsPlaced++;
        edgeValues.push(ev);

        // Flat staking
        const flatStake = 100;
        totalStakedFlat += flatStake;
        const profitFlat = actualHomeWin === 1 ? flatStake * (oddsCloseHome - 1) : -flatStake;
        totalReturnedFlat += actualHomeWin === 1 ? flatStake * oddsCloseHome : 0;
        bankrollFlat += profitFlat;

        // Kelly staking (Quarter Kelly)
        const kellyFraction = 0.25 * (ev / (oddsCloseHome - 1));
        const kellyStake = Math.min(bankrollKelly * kellyFraction, bankrollKelly * 0.05); // cap at 5% bankroll

        if (kellyStake > 0) {
          totalStakedKelly += kellyStake;
          const profitKelly = actualHomeWin === 1 ? kellyStake * (oddsCloseHome - 1) : -kellyStake;
          totalReturnedKelly += actualHomeWin === 1 ? kellyStake * oddsCloseHome : 0;
          bankrollKelly += profitKelly;

          if (actualHomeWin === 1) {
            winCount++;
          }

          // Calculate Drawdowns
          if (bankrollKelly > peakKelly) peakKelly = bankrollKelly;
          const dd = (peakKelly - bankrollKelly) / peakKelly;
          if (dd > maxDrawdownKelly) maxDrawdownKelly = dd;

          dailyReturns.push(profitKelly / kellyStake);
        }

        // Calculate Closing Line Value beat: CLV = (OpeningOdds / ClosingOdds - 1) * 100
        const clv = (oddsOpenHome / oddsCloseHome - 1) * 100;
        clvValues.push(clv);
      }
    }

    const totalBetsPlaced = betsPlaced;
    const hitRate = totalBetsPlaced > 0 ? winCount / totalBetsPlaced : 0;
    const roiFlat = totalStakedFlat > 0 ? (totalReturnedFlat - totalStakedFlat) / totalStakedFlat : 0;
    const yieldFlat = roiFlat; // in sports betting, Yield = ROI when total return is calculated against total stakes
    const avgCLV = clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : 0;
    const avgEdge = edgeValues.length > 0 ? edgeValues.reduce((a, b) => a + b, 0) / edgeValues.length : 0;

    // Sharpe Ratio
    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
      const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? mean / stdDev : 0;
    }

    const kellyGrowth = bankrollKelly / initialBankroll - 1;

    // ECE and MCE
    const ece = CalibrationEngine.calculateECE(predictionsList);
    const mce = CalibrationEngine.calculateMCE(predictionsList);

    return {
      totalMatches: testFixtures.length,
      totalBetsPlaced,
      winCount,
      hitRate: Number((hitRate * 100).toFixed(2)),
      initialBankroll,
      finalBankroll: Number(bankrollKelly.toFixed(2)),
      roi: Number((roiFlat * 100).toFixed(2)),
      yield: Number((yieldFlat * 100).toFixed(2)),
      brierScore: Number((brierSum / testFixtures.length).toFixed(4)),
      logLoss: Number((logLossSum / testFixtures.length).toFixed(4)),
      averageCLV: Number(avgCLV.toFixed(2)),
      maxDrawdown: Number((maxDrawdownKelly * 100).toFixed(2)),
      kellyGrowth: Number((kellyGrowth * 100).toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      averageEdge: Number((avgEdge * 100).toFixed(2)),
      ece: Number(ece.toFixed(4)),
      mce: Number(mce.toFixed(4))
    };
  }
}
