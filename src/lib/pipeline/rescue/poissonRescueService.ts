// ============================================================================
// SALMO RESCUE PIPELINE SERVICE (MVP POISSON V1 RESCUE)
// Namespace: src/lib/pipeline/rescue/poissonRescueService.ts
// Model Version: poisson_v1_rescue
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import {
  RescuePredictionRecord,
  RescueRunTelemetry,
  RescueMarketType,
} from './types';
import { RescueQuotaGuard } from './quotaGuard';
import { RescueFixtureIngestion } from './fixtureIngestion';
import { RescueSettlementEngine, FinalMatchScore } from './settlementEngine';
import { RescuePredictionGenerator } from './predictionGenerator';
import {
  getBatchedFixtureOdds,
  primeTournamentOdds,
} from '../tournamentOddsBatch';

export interface RescuePipelineOptions {
  targetDate?: string;
  season?: number;
  finishedScores?: FinalMatchScore[];
  apiKeyOverride?: string;
  skipOddsFetch?: boolean;
}

export class PoissonRescueService {
  public static readonly MODEL_VERSION = 'poisson_v1_rescue' as const;

  public static getLedgerFilePath(): string {
    return path.resolve('data/ledger/rescue_prediction_ledger.jsonl');
  }

  public static generateCompositeKey(
    fixtureId: number,
    market: RescueMarketType,
    line: number | null,
    selection: string,
    runId: string
  ): string {
    return RescuePredictionGenerator.generateCompositeKey(fixtureId, market, line, selection, runId);
  }

  public static async execute(
    options: RescuePipelineOptions = {}
  ): Promise<{ telemetry: RescueRunTelemetry; predictions: RescuePredictionRecord[] }> {
    const startMs = Date.now();
    const runId = `RUN-RESCUE-${Date.now()}`;
    const executedAt = new Date().toISOString();
    const targetDate = options.targetDate || executedAt.slice(0, 10);
    const season = options.season || 2026;

    console.log(`\n============================================================`);
    console.log(`STARTING SALMO RESCUE PIPELINE [${runId}]`);
    console.log(`Model Version: ${this.MODEL_VERSION} | Target Date: ${targetDate}`);
    console.log(`============================================================`);

    // OPERATION 0: QUOTA GUARD
    const quotaResult = await RescueQuotaGuard.checkOddsPapiQuota(options.apiKeyOverride);
    const allowOdds = quotaResult.allowOddsFetch && !options.skipOddsFetch;

    console.log(`[Quota Guard] Status: ${quotaResult.status} | Remaining: ${quotaResult.quotaRemaining}/${quotaResult.requestLimit}`);
    if (!allowOdds) {
      console.warn(`[Quota Guard] Odds fetch disabled for this run: ${quotaResult.reason || 'QUOTA_CRITICAL'}`);
    }

    // OPERATION 1: FIXTURE INGESTION
    const ingestion = await RescueFixtureIngestion.ingestFixturesForDate(targetDate, season);
    const eligibleFixtures = ingestion.fixtures.filter((f) => f.eligible);
    const runFlags = new Set<string>(ingestion.dataQualityFlags);

    console.log(`[Ingestion] Discovered ${ingestion.fixtures.length} matches across whitelisted leagues (${eligibleFixtures.length} eligible)`);

    if (eligibleFixtures.length === 0) {
      console.log(`[Rescue Pipeline] No eligible fixtures today. Completing as SUCCESS_EMPTY.`);
      const emptyTelemetry: RescueRunTelemetry = {
        run_id: runId,
        model_version: this.MODEL_VERSION,
        status: 'SUCCESS_EMPTY',
        fixture_count: 0,
        prediction_count: 0,
        odds_count: 0,
        settled_count: 0,
        picks_generated: 0,
        error_count: 0,
        duration_ms: Date.now() - startMs,
        quota_remaining: quotaResult.quotaRemaining,
        data_sources: { fixtures: 'api-football', odds: 'oddspapi' },
        data_quality_flags: Array.from(runFlags),
        executed_at: executedAt,
      };

      return { telemetry: emptyTelemetry, predictions: [] };
    }

    // OPERATION 2: PRIME ODDS BATCH IF PERMITTED
    if (allowOdds) {
      try {
        const tournamentIds = Array.from(new Set(eligibleFixtures.map((f) => f.competitionId)));
        await primeTournamentOdds({
          tournamentIds,
          bookmakers: ['pinnacle', 'sbobet'],
        });
      } catch (e: any) {
        console.warn('[Rescue Pipeline] Failed to prime tournament odds batch:', e?.message);
        runFlags.add('ODDS_PRIME_WARNING');
      }
    }

    // OPERATION 3: PREDICTION GENERATION
    const allPredictions: RescuePredictionRecord[] = [];
    let oddsFoundCount = 0;
    let picksCount = 0;

    for (const fixture of eligibleFixtures) {
      const batchOdds = allowOdds ? getBatchedFixtureOdds(fixture.fixtureId) : null;
      const genResult = RescuePredictionGenerator.generatePredictionsForFixture(
        fixture,
        batchOdds,
        allowOdds,
        runId,
        executedAt
      );

      allPredictions.push(...genResult.predictions);
      oddsFoundCount += genResult.oddsFound;
      picksCount += genResult.picksFound;
    }

    // OPERATION 4: SETTLEMENT EXECUTION
    let settledCount = 0;
    let finalPredictions = allPredictions;

    if (options.finishedScores && options.finishedScores.length > 0) {
      const settleResult = RescueSettlementEngine.batchSettle(allPredictions, options.finishedScores);
      finalPredictions = settleResult.settled;
      settledCount = settleResult.count;
      console.log(`[Settlement] Successfully settled ${settledCount} prediction records.`);
    }

    // OPERATION 5: DURABLE LEDGER PERSISTENCE
    try {
      const ledgerPath = this.getLedgerFilePath();
      const ledgerDir = path.dirname(ledgerPath);
      if (!fs.existsSync(ledgerDir)) {
        fs.mkdirSync(ledgerDir, { recursive: true });
      }

      const content = finalPredictions.map((row) => JSON.stringify(row)).join('\n') + '\n';
      fs.appendFileSync(ledgerPath, content, 'utf8');
      console.log(`[Ledger] Persisted ${finalPredictions.length} predictions to ${ledgerPath}`);
    } catch (e: any) {
      console.error('[Ledger] Failed to write to JSONL ledger:', e?.message);
    }

    const telemetry: RescueRunTelemetry = {
      run_id: runId,
      model_version: this.MODEL_VERSION,
      status: 'SUCCESS',
      fixture_count: eligibleFixtures.length,
      prediction_count: finalPredictions.length,
      odds_count: oddsFoundCount,
      settled_count: settledCount,
      picks_generated: picksCount,
      error_count: 0,
      duration_ms: Date.now() - startMs,
      quota_remaining: quotaResult.quotaRemaining,
      data_sources: { fixtures: 'api-football', odds: 'oddspapi' },
      data_quality_flags: Array.from(runFlags),
      executed_at: executedAt,
    };

    console.log(`\n[Execution Summary] Status: ${telemetry.status} | Fixtures: ${telemetry.fixture_count} | Predictions: ${telemetry.prediction_count} | Picks: ${telemetry.picks_generated}`);
    console.log(`Duration: ${telemetry.duration_ms}ms | Quota Remaining: ${telemetry.quota_remaining}`);

    return { telemetry, predictions: finalPredictions };
  }
}
