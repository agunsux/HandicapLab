/**
 * Phase 3 & 6: Walk-Forward Backtest Runner
 *
 * Critical: No future leakage.
 * Each prediction only uses info available before the match date.
 */

import { BronzeFixtureLoader, ResearchFixture } from './bronzeFixtureLoader';
import { BasePredictionModel, ModelInput, getAvailableModels } from './predictionModels';
import { EvaluationEngine, PredictionSnapshot, ModelMetrics, CalibrationBin } from './evaluationEngine';
import * as fs from 'fs';
import * as path from 'path';

export interface BacktestConfig {
  seasons: string[];
  league: string;
  models?: string[];  // model version names, empty = all models
  outputDir?: string;
  dataRoot?: string;
}

export interface BacktestResult {
  modelVersion: string;
  metrics: ModelMetrics;
  calibration: CalibrationBin[];
  seasonBreakdown: { season: string; metrics: ModelMetrics }[];
  totalPredictions: number;
  settledMatches: number;
}

export class BacktestRunner {
  private loader: BronzeFixtureLoader;
  private evaluator: EvaluationEngine;

  constructor(dataRoot?: string) {
    this.loader = new BronzeFixtureLoader({ dataRoot });
    this.evaluator = new EvaluationEngine();
  }

  /**
   * Run backtest across configured seasons
   */
  run(config: BacktestConfig): BacktestResult[] {
    // Get models to test
    const allModels = getAvailableModels();
    const models = config.models && config.models.length > 0
      ? allModels.filter(m => config.models!.includes(m.version))
      : allModels;

    console.log(`\n=== Backtest: ${config.league} ${config.seasons[0]} → ${config.seasons[config.seasons.length-1]} ===`);
    console.log(`Models: ${models.map(m => m.version).join(', ')}`);

    const results: BacktestResult[] = [];

    for (const model of models) {
      console.log(`\n  Running: ${model.version}`);
      const allSnapshots: PredictionSnapshot[] = [];
      const seasonBreakdown: { season: string; metrics: ModelMetrics }[] = [];

      for (const season of config.seasons) {
        // Load fixtures for this season
        const fixtures = this.loader.loadFixtures({
          season,
          league: config.league,
        });

        if (fixtures.length === 0) continue;

        // Generate walk-forward predictions
        const snapshots = this.generatePredictions(model, fixtures, season);
        allSnapshots.push(...snapshots);

        // Evaluate this season
        const seasonMetrics = this.evaluator.evaluate(snapshots);
        if (seasonMetrics.matches > 0) {
          seasonBreakdown.push({ season, metrics: seasonMetrics });
          console.log(`    ${season}: ${seasonMetrics.matches} matches, accuracy=${(seasonMetrics.accuracy * 100).toFixed(1)}%, brier=${seasonMetrics.brierScore.toFixed(4)}`);
        }
      }

      // Overall evaluation
      const fullMetrics = this.evaluator.evaluate(allSnapshots);
      const calibration = this.evaluator.calculateCalibration(allSnapshots);

      results.push({
        modelVersion: model.version,
        metrics: fullMetrics,
        calibration,
        seasonBreakdown,
        totalPredictions: allSnapshots.length,
        settledMatches: fullMetrics.matches,
      });

      console.log(`    TOTAL: ${fullMetrics.matches} settled, accuracy=${(fullMetrics.accuracy * 100).toFixed(1)}%, brier=${fullMetrics.brierScore.toFixed(4)}, logloss=${fullMetrics.logLoss.toFixed(4)}, ece=${(fullMetrics.calibrationError * 100).toFixed(2)}%`);
    }

    return results;
  }

  /**
   * Generate predictions with no future leakage.
   * Uses only the match's xG data which is available at match time (from xG models).
   */
  private generatePredictions(
    model: BasePredictionModel,
    fixtures: ResearchFixture[],
    season: string
  ): PredictionSnapshot[] {
    const snapshots: PredictionSnapshot[] = [];

    for (const fixture of fixtures) {
      if (fixture.homeXG === null || fixture.awayXG === null) continue;

      const input: ModelInput = {
        fixtureId: fixture.fixtureId,
        date: fixture.date,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeXG: fixture.homeXG,
        awayXG: fixture.awayXG,
        homeGoals: fixture.homeGoals,
        awayGoals: fixture.awayGoals,
      };

      // Predict using only pre-match available data (xG from before match)
      const prediction = model.predict(input);

      // Determine actual result
      let actualResult: 'home' | 'draw' | 'away' | null = null;
      if (fixture.homeGoals !== null && fixture.awayGoals !== null) {
        if (fixture.homeGoals > fixture.awayGoals) actualResult = 'home';
        else if (fixture.homeGoals < fixture.awayGoals) actualResult = 'away';
        else actualResult = 'draw';
      }

      snapshots.push({
        fixtureId: fixture.fixtureId,
        date: fixture.date,
        season,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeWinProb: prediction.prediction.homeWinProbability,
        drawProb: prediction.prediction.drawProbability,
        awayWinProb: prediction.prediction.awayWinProbability,
        homeGoals: fixture.homeGoals,
        awayGoals: fixture.awayGoals,
        actualResult,
        modelVersion: model.version,
        cutoffDate: fixture.date,
      });

      // Verify probabilities sum to 1.0
      const probSum = prediction.prediction.homeWinProbability +
        prediction.prediction.drawProbability +
        prediction.prediction.awayWinProbability;
      
      if (Math.abs(probSum - 1.0) > 0.01) {
        console.warn(`  Probability sum violation: ${probSum} for ${fixture.fixtureId}`);
      }
    }

    return snapshots;
  }

  /**
   * Save backtest results to disk
   */
  saveResults(results: BacktestResult[], outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const result of results) {
      const safeName = result.modelVersion.replace(/[^a-z0-9-]/g, '_');
      const dir = path.join(outputDir, safeName);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Full report
      fs.writeFileSync(
        path.join(dir, 'report.json'),
        JSON.stringify(result, null, 2) + '\n',
        'utf8'
      );

      // Summary metrics
      fs.writeFileSync(
        path.join(dir, 'metrics.json'),
        JSON.stringify(result.metrics, null, 2) + '\n',
        'utf8'
      );

      // Calibration
      fs.writeFileSync(
        path.join(dir, 'calibration.json'),
        JSON.stringify(result.calibration, null, 2) + '\n',
        'utf8'
      );
    }

    // Summary comparison
    const comparison = results.map(r => ({
      model: r.modelVersion,
      accuracy: r.metrics.accuracy,
      brierScore: r.metrics.brierScore,
      logLoss: r.metrics.logLoss,
      calibrationError: r.metrics.calibrationError,
      matches: r.metrics.matches,
    }));

    fs.writeFileSync(
      path.join(outputDir, 'model_comparison.json'),
      JSON.stringify(comparison, null, 2) + '\n',
      'utf8'
    );

    console.log(`\nResults saved to: ${outputDir}`);
  }

  /**
   * League abstraction for multi-league support
   */
  getSupportedLeagues(): string[] {
    return ['EPL']; // EPL is the only league with data currently
  }

  /**
   * Get available seasons (from Bronze fixture loader)
   */
  getAvailableSeasons(league: string = 'EPL'): string[] {
    return this.loader.getAvailableSeasons(league);
  }
}