/**
 * HandicapLab Replay Runner
 * ==========================
 * Executes historical matches through the Prediction Engine.
 *
 * Flow:
 *   Load fixtures → Load odds → Predict → Compare with results → Compute metrics
 *
 * The Prediction Engine is invoked through the Predictor interface.
 * No production code is modified.
 */

import crypto from 'crypto';
import { HistoricalFixture, HistoricalOdds, HistoricalResult, ReplayConfig, ReplayContext, ReplayMetrics, ReplayOutcome, ReplayResult, ReplayValidationReport } from './types';
import { Predictor, HistoricalDataProvider } from './providers';
import { createReplayContext } from './ReplayContext';
import { validateDataset } from './validator';

export class ReplayRunner {
  constructor(
    private readonly dataProvider: HistoricalDataProvider,
    private readonly predictor: Predictor,
    private readonly config: ReplayConfig = {}
  ) {}

  async run(): Promise<ReplayResult> {
    const id = crypto.randomUUID();
    const context = createReplayContext({
      provider: this.dataProvider.name,
      leagueId: this.config.leagueId,
      season: this.config.season,
      startDate: this.config.startDate,
      endDate: this.config.endDate,
    });

    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // 1. Load historical matches
    const matches = await this.dataProvider.loadMatches(context);

    // 2. Validate
    const validationReport = validateDataset(matches, context);

    // 3. Filter valid matches
    const validFixtures = matches.filter((m) => m.result !== undefined && m.odds.length > 0);

    // 4. Apply config limits
    const limitedFixtures = this.config.maxMatches ? validFixtures.slice(0, this.config.maxMatches) : validFixtures;

    // 5. Run predictions
    const outcomes: ReplayOutcome[] = [];
    for (const match of limitedFixtures) {
      const result = match.result!;
      const { homeGoals, awayGoals } = result;

      for (const odds of match.odds) {
        // Select market: default to ML if available
        const marketType = odds.market || 'ML';
        const marketOdds = odds.homeOdds || odds.closingHomeOdds || 2.0;
        const selection = marketOdds <= 2.0 ? 'home' : 'away';

        try {
          const prediction = await this.predictor.predict(
            {
              matchId: match.fixture.id,
              homeTeam: match.fixture.homeTeam,
              awayTeam: match.fixture.awayTeam,
              leagueId: match.fixture.leagueId,
              marketType,
            },
            marketOdds,
            selection
          );

          // Determine actual result
          const actualHomeGoals = homeGoals ?? 0;
          const actualAwayGoals = awayGoals ?? 0;
          let actualResult: number;
          if (selection === 'home') {
            actualResult = actualHomeGoals > actualAwayGoals ? 1 : (actualHomeGoals === actualAwayGoals ? 0.5 : 0);
          } else if (selection === 'away') {
            actualResult = actualAwayGoals > actualHomeGoals ? 1 : (actualAwayGoals === actualHomeGoals ? 0.5 : 0);
          } else {
            actualResult = actualHomeGoals === actualAwayGoals ? 1 : 0;
          }

          // Compute metrics
          const probability = selection === 'home' ? prediction.homeProbability : (selection === 'away' ? prediction.awayProbability : prediction.drawProbability);
          const profitLoss = actualResult === 1 ? prediction.stake * (marketOdds - 1) : (actualResult === 0.5 ? 0 : -prediction.stake);
          const brierScore = Math.pow(probability - actualResult, 2);
          const logLoss = actualResult === 1 ? -Math.log(Math.max(0.001, probability)) : (actualResult === 0 ? -Math.log(Math.max(0.001, 1 - probability)) : 0);
          const clv = odds.openingHomeOdds && odds.closingHomeOdds ? (odds.openingHomeOdds / odds.closingHomeOdds) - 1 : 0;

          outcomes.push({
            matchId: match.fixture.id,
            marketType,
            selection,
            predictedProbability: probability,
            actualResult,
            profitLoss: Math.round(profitLoss * 10000) / 10000,
            brierScore: Math.round(brierScore * 10000) / 10000,
            logLoss: Math.round(logLoss * 10000) / 10000,
            clv: Math.round(clv * 10000) / 10000,
          });
        } catch {
          // Skip matches that fail prediction
          continue;
        }
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // 6. Compute aggregate metrics
    const metrics = this.computeMetrics(outcomes);

    return {
      id,
      config: this.config,
      context,
      metrics,
      outcomes,
      validationReport,
      startedAt,
      completedAt,
      durationMs,
    };
  }

  private computeMetrics(outcomes: ReplayOutcome[]): ReplayMetrics {
    const totalPredictions = outcomes.length;
    const won = outcomes.filter((o) => o.actualResult === 1).length;
    const lost = outcomes.filter((o) => o.actualResult === 0).length;
    const voided = outcomes.filter((o) => o.actualResult === 0.5).length;
    const totalProfit = outcomes.reduce((sum, o) => sum + o.profitLoss, 0);
    const totalStake = totalPredictions; // each stake is 1 unit
    const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
    const brierScore = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.brierScore, 0) / outcomes.length : 0;
    const logLoss = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.logLoss, 0) / outcomes.length : 0;
    const avgClv = outcomes.length > 0 ? outcomes.reduce((sum, o) => sum + o.clv, 0) / outcomes.length : 0;
    const winRate = totalPredictions > 0 ? (won / totalPredictions) * 100 : 0;

    return {
      totalMatches: new Set(outcomes.map((o) => o.matchId)).size,
      totalPredictions,
      won,
      lost,
      voided,
      roi: Math.round(roi * 100) / 100,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      avgClv: Math.round(avgClv * 10000) / 10000,
      winRate: Math.round(winRate * 100) / 100,
      totalStake: Math.round(totalStake * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
    };
  }
}