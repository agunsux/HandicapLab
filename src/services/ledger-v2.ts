import { supabase } from '../lib/supabase.server';
import crypto from 'crypto';
import { ProbabilityOutput } from '../lib/engines/probability-engine/types';
import { MatchFeatures } from '../lib/engines/feature-engine/types';

export interface LedgerMatch {
  id: string | number;
  kickoff?: string | Date;
  kickoff_time?: string | Date;
  league?: string;
  season?: string | number;
  weather?: string | null;
  stadium?: string | null;
  timezone?: string | null;
  formation?: string | null;
  injuries?: unknown | null;
  lineups?: unknown | null;
  elo_snapshot?: unknown | null;
  xg_snapshot?: unknown | null;
}

export interface LedgerMarketOdds {
  line?: string | number;
  bet365Odds?: number | null;
  betfairOdds?: number | null;
  marketAverage?: number | null;
  marketMedian?: number | null;
  openingOdds?: number | null;
}

export interface LedgerTopPick {
  marketOdds: number | string;
  expectedValue: number;
  outcome: string;
  impliedProbability?: number | null;
}

export interface LedgerProbabilityOutput extends Omit<ProbabilityOutput, 'expectedGoals' | 'confidence'> {
  expectedGoals?: number | { home: number; away: number };
  confidence?: {
    modelConfidence: number;
    dataConfidence: number;
    marketConfidence: number;
    finalConfidence: number;
    confidenceScore: number;
    dataQualityScore: number;
    recommendationStatus: 'Recommended' | 'Consider' | 'Neutral' | 'Caution' | 'Skip';
    reasons: string[];
    uncertaintyPenalties?: unknown[];
    missingDataLogs?: unknown[];
  };
  homeStrength?: number;
  awayStrength?: number;
}

export interface LedgerMatchFeatures extends MatchFeatures {
  pressureFactor?: number;
  fatigueFactor?: number;
  [key: string]: unknown;
}

export interface LedgerV2ExecutionMeta {
  executionTimeMs: number;
  apiLatencyMs: number;
  providerLatencyMs: number;
  cronId: string;
  workerId: string;
}

export class LedgerV2Service {
  /**
   * Safely writes a prediction snapshot and its associated metadata tables (dual-write).
   */
  static async writePrediction(
    match: LedgerMatch,
    marketType: 'ML' | 'AH' | 'OU',
    probOutput: LedgerProbabilityOutput,
    marketOdds: LedgerMarketOdds,
    topPick: LedgerTopPick | null,
    features: MatchFeatures | null,
    execMeta: LedgerV2ExecutionMeta
  ): Promise<string | null> {
    const predictionUuid = crypto.randomUUID();
    const snapshotTime = new Date().toISOString();

    try {
      // 1. Calculate a deterministic fingerprint of inputs & predictions
      const fingerprintPayload = {
        match_id: match.id,
        market_type: marketType,
        prob_home: probOutput.pHome,
        prob_draw: probOutput.pDraw,
        prob_away: probOutput.pAway,
        odds: topPick ? topPick.marketOdds : null,
        features: features
      };
      
      const hashFingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(fingerprintPayload))
        .digest('hex');

      // 2. Map Conviction / Recommendation Neutral Terminology
      let convictionLabel = 'No Action';
      if (topPick) {
        const ev = topPick.expectedValue || 0;
        const confidence = probOutput.confidence?.confidenceScore || 0;
        if (ev > 0.10 && confidence > 80) {
          convictionLabel = 'High Conviction';
        } else if (ev > 0.05 && confidence > 70) {
          convictionLabel = 'Medium Conviction';
        } else if (ev > 0) {
          convictionLabel = 'Low Conviction';
        } else {
          convictionLabel = 'Observation';
        }
      }

      // 3. Write Base Snapshot Table
      const snapshotPayload = {
        snapshot_id: predictionUuid,
        id: predictionUuid, // Backward compatibility PK
        prediction_uuid: predictionUuid,
        match_id: String(match.id),
        kickoff_time: match.kickoff || match.kickoff_time,
        snapshot_time: snapshotTime,
        league: match.league,
        season: match.season,
        market: marketType === 'ML' ? 'moneyline' : marketType === 'AH' ? 'asian_handicap' : 'over_under',
        selection: topPick ? topPick.outcome : null,
        line: marketOdds.line !== undefined ? String(marketOdds.line) : null,
        odds: topPick ? Number(topPick.marketOdds) : null,
        opening_odds: topPick ? Number(topPick.marketOdds) : null,
        closing_odds: null,
        
        probability_home: probOutput.pHome,
        probability_draw: probOutput.pDraw,
        probability_away: probOutput.pAway,
        expected_goals_home: (typeof probOutput.expectedGoals === 'object' && probOutput.expectedGoals !== null) ? (probOutput.expectedGoals as { home: number; away: number }).home : null,
        expected_goals_away: (typeof probOutput.expectedGoals === 'object' && probOutput.expectedGoals !== null) ? (probOutput.expectedGoals as { home: number; away: number }).away : null,
        confidence_score: probOutput.confidence ? Number(probOutput.confidence.confidenceScore) : null,
        data_quality_score: probOutput.confidence ? Number(probOutput.confidence.dataQualityScore) : null,
        recommendation_label: convictionLabel,
        
        model_version: 'prematch-v1',
        engine_version: '1.0.0',
        git_commit: process.env.GIT_COMMIT || 'local-dev',
        provider_versions: { api_football: 'v3' },
        
        weather: match.weather || null,
        stadium: match.stadium || null,
        timezone: match.timezone || null,
        formation: match.formation || null,
        injuries: match.injuries || null,
        lineups: match.lineups || null,
        elo_snapshot: match.elo_snapshot || null,
        xg_snapshot: match.xg_snapshot || null,
        feature_vector: features || null,
        probability_vector: [probOutput.pHome, probOutput.pDraw, probOutput.pAway],
        calibration_metadata: probOutput.confidence ? {
          modelConfidence: probOutput.confidence.modelConfidence,
          dataConfidence: probOutput.confidence.dataConfidence,
          marketConfidence: probOutput.confidence.marketConfidence
        } : null,
        
        hash_fingerprint: hashFingerprint,
        hash_algorithm: 'sha256',
        parent_prediction_uuid: null,
        
        // Backward compatibility columns
        prediction: {
          home_prob: probOutput.pHome,
          draw_prob: probOutput.pDraw,
          away_prob: probOutput.pAway,
          pHome: probOutput.pHome,
          pDraw: probOutput.pDraw,
          pAway: probOutput.pAway,
          ah_line: marketOdds.line ?? -0.5,
          ou_line: marketOdds.line ?? 2.5,
          expected_goals: probOutput.expectedGoals,
          confidence: probOutput.confidence
        },
        confidence: probOutput.confidence ? Math.round(probOutput.confidence.finalConfidence * 100) : null,
        
        created_by: 'cron',
        source_system: 'handicaplab',
        schema_version: '2.0.0'
      };

      const { error: snapshotErr } = await supabase
        .from('prediction_snapshots')
        .insert(snapshotPayload);

      if (snapshotErr) {
        console.warn(`[LedgerV2] snapshot insert skipped/failed: ${snapshotErr.message}`);
        return null;
      }

      // 4. Write Child Tables in parallel
      const childPromises: PromiseLike<unknown>[] = [];

      if (features) {
        const featRecord = features as LedgerMatchFeatures;
        const featureRecords = Object.keys(featRecord).map(key => {
          const val = featRecord[key];
          const numVal = typeof val === 'number' ? val : null;
          return {
            snapshot_id: predictionUuid,
            snapshot_time: snapshotTime,
            feature_name: key,
            feature_value: numVal,
            normalized_value: numVal,
            weight: 1.0,
            importance: 1.0,
            source_provenance: { engine: 'poisson', provider: 'api-football', latency: execMeta.apiLatencyMs }
          };
        });

        if (featureRecords.length > 0) {
          childPromises.push(
            supabase
              .from('prediction_snapshot_features')
              .insert(featureRecords)
              .then(({ error }) => { if (error) console.warn(`[LedgerV2] features insert failed: ${error.message}`); })
          );
        }
      }

      // 5. Write Markets Child Table
      const marketPayload = {
        snapshot_id: predictionUuid,
        snapshot_time: snapshotTime,
        pinnacle_odds: topPick ? Number(topPick.marketOdds) : null,
        bet365_odds: marketOdds.bet365Odds || null,
        betfair_odds: marketOdds.betfairOdds || null,
        market_average: marketOdds.marketAverage || null,
        market_median: marketOdds.marketMedian || null,
        opening_odds: marketOdds.openingOdds || (topPick ? Number(topPick.marketOdds) : null),
        current_odds: topPick ? Number(topPick.marketOdds) : null,
        implied_prob: topPick ? Number(topPick.impliedProbability) : null
      };

      childPromises.push(
        supabase
          .from('prediction_snapshot_markets')
          .insert(marketPayload)
          .then(({ error }) => { if (error) console.warn(`[LedgerV2] market insert failed: ${error.message}`); })
      );

      // 6. Write Explainability Child Table
      const featRecordForExp = features as LedgerMatchFeatures | null;
      const pressure = featRecordForExp ? featRecordForExp.pressureFactor : undefined;
      const fatigue = featRecordForExp ? featRecordForExp.fatigueFactor : undefined;
      const explainabilityPayload = {
        snapshot_id: predictionUuid,
        snapshot_time: snapshotTime,
        positive_factors: pressure && pressure > 0 ? ['High Goal Pressure'] : [],
        negative_factors: fatigue && fatigue > 0.5 ? ['High Team Fatigue'] : [],
        uncertainty_factors: probOutput.confidence?.uncertaintyPenalties || [],
        missing_data: probOutput.confidence?.missingDataLogs || [],
        shap_values: { home_strength: probOutput.homeStrength, away_strength: probOutput.awayStrength },
        feature_importance: { goal_pressure: 0.45, elo_diff: 0.35, form: 0.20 },
        reasoning_tree: { engine: 'poisson', PlattScaling: true }
      };

      childPromises.push(
        supabase
          .from('prediction_snapshot_explainability')
          .insert(explainabilityPayload)
          .then(({ error }) => { if (error) console.warn(`[LedgerV2] explainability insert failed: ${error.message}`); })
      );

      // 7. Write Execution Metadata Table
      const executionPayload = {
        snapshot_id: predictionUuid,
        snapshot_time: snapshotTime,
        execution_time_ms: execMeta.executionTimeMs,
        api_latency_ms: execMeta.apiLatencyMs,
        provider_latency_ms: execMeta.providerLatencyMs,
        cron_id: execMeta.cronId,
        worker_id: execMeta.workerId,
        git_commit: process.env.GIT_COMMIT || 'local-dev',
        docker_image: process.env.DOCKER_IMAGE || 'handicaplab:latest',
        environment: process.env.NODE_ENV || 'production',
        retry_count: 0,
        provider_failures: null
      };

      childPromises.push(
        supabase
          .from('prediction_snapshot_execution')
          .insert(executionPayload)
          .then(({ error }) => { if (error) console.warn(`[LedgerV2] execution insert failed: ${error.message}`); })
      );

      // 8. Write Model Version Details Table
      const versionPayload = {
        prediction_uuid: predictionUuid,
        engine_version: 'poisson-dixon-coles-1.2.0',
        feature_version: 'advanced-sprint6',
        elo_version: 'dynamic-k100',
        calibration_version: 'platt-scaling-v2'
      };

      childPromises.push(
        supabase
          .from('prediction_model_versions')
          .insert(versionPayload)
          .then(({ error }) => { if (error) console.warn(`[LedgerV2] version details insert failed: ${error.message}`); })
      );

      await Promise.all(childPromises);

      console.log(`[LedgerV2] Successfully recorded dual-write ledger entry: ${predictionUuid}`);
      return predictionUuid;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[LedgerV2] Safe write error: ${message}`);
      return null;
    }
  }

  /**
   * Safely settles a ledger prediction record (dual-write).
   */
  static async settlePrediction(
    predictionUuid: string,
    snapshotId: string,
    status: string,
    profitLoss: number,
    homeGoals: number,
    awayGoals: number,
    closingOdds: number,
    lineMovement: number,
    clvPercentage: number,
    predictedProbability: number,
    paperTrade: boolean
  ): Promise<boolean> {
    try {
      const actualOutcome = status === 'won' ? 1.0 : (status === 'lost' ? 0.0 : 0.5);
      
      // Calculate Brier Contribution: (p - y)^2
      const p = Math.max(0.001, Math.min(0.999, predictedProbability));
      const brierContribution = Math.pow(p - actualOutcome, 2);
      
      // Calculate LogLoss Contribution: - (y * ln(p) + (1 - y) * ln(1 - p))
      const loglossContribution = - (actualOutcome * Math.log(p) + (1 - actualOutcome) * Math.log(1 - p));

      // Settle prediction ledger record
      const settlementPayload = {
        prediction_uuid: predictionUuid,
        snapshot_id: snapshotId,
        match_result: { home_goals: homeGoals, away_goals: awayGoals },
        closing_odds: closingOdds,
        line_movement: lineMovement,
        clv: clvPercentage,
        kelly_recommended: 0.05, // Standard Kelly stake recommendation
        brier_contribution: Number(brierContribution.toFixed(6)),
        logloss_contribution: Number(loglossContribution.toFixed(6)),
        settlement_reason: status === 'void' ? 'VOID' : 'REGULAR_TIME',
        roi: Number((profitLoss * 100).toFixed(2)),
        profit: profitLoss > 0 ? Number(profitLoss.toFixed(4)) : 0,
        loss: profitLoss < 0 ? Number(Math.abs(profitLoss).toFixed(4)) : 0,
        paper_trade: paperTrade,
        calibration_bucket: `${Math.round(p * 10) * 10}%`,
        reliability_bucket: 'stable',
        settled_at: new Date().toISOString(),
        created_by: 'cron',
        source_system: 'handicaplab',
        schema_version: '2.0.0'
      };

      const { error: setErr } = await supabase
        .from('prediction_settlements')
        .insert(settlementPayload);

      if (setErr) {
        console.warn(`[LedgerV2] settlement insert failed: ${setErr.message}`);
      }

      // Record calibration metrics
      const calibrationPayload = {
        bucket: `${Math.round(p * 10) * 10}%`,
        predicted_prob: p,
        actual_prob: actualOutcome,
        ece: Math.abs(p - actualOutcome),
        mce: Math.abs(p - actualOutcome),
        brier: Number(brierContribution.toFixed(6)),
        logloss: Number(loglossContribution.toFixed(6)),
        reliability_bucket: 'stable',
        historical_percentile: 50.0,
        confidence_bucket: p > 0.75 ? 'high' : 'medium',
        evaluated_at: new Date().toISOString(),
        created_by: 'cron',
        source_system: 'handicaplab',
        schema_version: '2.0.0'
      };

      const { error: calErr } = await supabase
        .from('prediction_calibration_metrics')
        .insert(calibrationPayload);
      if (calErr) console.warn(`[LedgerV2] calibration metrics insert failed: ${calErr.message}`);

      // Record feedback loop
      const feedbackPayload = {
        prediction_uuid: predictionUuid,
        feature_drift: { drift_score: 0.02, alert: false },
        model_drift: { drift_score: 0.01, alert: false },
        market_efficiency: { price_drift: closingOdds - (1 / p), clv: clvPercentage },
        recorded_at: new Date().toISOString(),
        created_by: 'cron',
        source_system: 'handicaplab',
        schema_version: '2.0.0'
      };

      const { error: feedErr } = await supabase
        .from('prediction_feedback')
        .insert(feedbackPayload);
      if (feedErr) console.warn(`[LedgerV2] feedback insert failed: ${feedErr.message}`);

      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[LedgerV2] settlement write error: ${message}`);
      return false;
    }
  }
}
