// Prediction Execution Service
// Location: src/services/predictionExecutionService.ts

import { ModelRegistryRepository } from '../lib/data/modelRegistryRepository';
import { PredictionLedgerRepository } from '../lib/data/predictionLedgerRepository';
import { ProbabilityEngine } from '../lib/engines/probability-engine';
import { MatchFeatures } from '../lib/engines/feature-engine/types';
import { ExplainabilityFormatter } from '../lib/engine/explainability-formatter';

import { DbMatch } from '../lib/data/match';

interface MatchFeaturesWithVersion extends MatchFeatures {
  featureVersion?: string;
}

export interface PredictionOddsSnapshot {
  bookmaker?: string;
  line?: number;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
}

export class PredictionExecutionService {
  /**
   * Runs predictions for both the Champion and active Challenger models on a match,
   * then records their outputs idempotently into the immutable prediction ledger.
   */
  public static async executeAndRecord(
    match: DbMatch,
    features: MatchFeatures,
    marketType: 'ML' | 'AH' | 'OU',
    oddsSnapshot?: PredictionOddsSnapshot
  ): Promise<{ championHash: string | null; challengerHashes: string[] }> {
    const challengerHashes: string[] = [];
    let championHash: string | null = null;

    try {
      // 1. Get Champion & Challenger models from Model Registry
      let activeModels = await ModelRegistryRepository.getActiveModels();
      if (activeModels.length === 0) {
        // Fallback default seeds if database registry is empty
        activeModels = [
          {
            model_id: 'prematch-v1',
            version: '1.0.0',
            role: 'champion',
            parameters: { calibrationMethod: 'platt', plattA: 1.02, plattB: -0.01 }
          },
          {
            model_id: 'prematch-v2-test',
            version: '1.1.0-beta',
            role: 'challenger',
            parameters: { calibrationMethod: 'platt', plattA: 1.05, plattB: -0.02 }
          }
        ];
      }

      // 2. Score with each model
      for (const model of activeModels) {
        const params = (model.parameters || {}) as Record<string, unknown>;

        // Run prediction
        const predictionOutput = await ProbabilityEngine.predict(features, {
          calibrationMethod: (params.calibrationMethod as 'platt' | 'isotonic' | 'beta' | 'none' | undefined) || 'platt',
          plattA: params.plattA as number | undefined,
          plattB: params.plattB as number | undefined,
          oddsSnapshot
        });

        // Determine selection and probabilities based on marketType
        let selection = 'home';
        let calibratedProb = predictionOutput.pHome;
        let rawProb = predictionOutput.pHome; // approximation of raw/pre-calibrated for ledger
        let marketOddsValue = oddsSnapshot ? (oddsSnapshot.homeOdds || 1.95) : 1.95;

        if (marketType === 'ML') {
          // Select highest probability outcome
          if (predictionOutput.pDraw > predictionOutput.pHome && predictionOutput.pDraw > predictionOutput.pAway) {
            selection = 'draw';
            calibratedProb = predictionOutput.pDraw;
            rawProb = predictionOutput.pDraw;
            marketOddsValue = oddsSnapshot ? (oddsSnapshot.drawOdds || 3.40) : 3.40;
          } else if (predictionOutput.pAway > predictionOutput.pHome && predictionOutput.pAway > predictionOutput.pDraw) {
            selection = 'away';
            calibratedProb = predictionOutput.pAway;
            rawProb = predictionOutput.pAway;
            marketOddsValue = oddsSnapshot ? (oddsSnapshot.awayOdds || 2.80) : 2.80;
          }
        } else if (marketType === 'AH') {
          const lineKey = oddsSnapshot && oddsSnapshot.line !== undefined ? String(oddsSnapshot.line) : '-0.5';
          const pH = predictionOutput.pAhHome[lineKey] || 0.5;
          const pA = predictionOutput.pAhAway[lineKey] || 0.5;
          if (pH >= pA) {
            selection = 'home';
            calibratedProb = pH;
            rawProb = pH;
            marketOddsValue = oddsSnapshot ? (oddsSnapshot.homeOdds || 1.95) : 1.95;
          } else {
            selection = 'away';
            calibratedProb = pA;
            rawProb = pA;
            marketOddsValue = oddsSnapshot ? (oddsSnapshot.awayOdds || 1.95) : 1.95;
          }
        } else {
          // Over Under
          const lineKey = oddsSnapshot && oddsSnapshot.line !== undefined ? String(oddsSnapshot.line) : '2.5';
          const pO = predictionOutput.pOver[lineKey] || 0.5;
          const pU = predictionOutput.pUnder[lineKey] || 0.5;
          if (pO >= pU) {
            selection = 'over';
            calibratedProb = pO;
            rawProb = pO;
            marketOddsValue = oddsSnapshot ? (oddsSnapshot.homeOdds || 1.95) : 1.95;
          } else {
            selection = 'under';
            calibratedProb = pU;
            rawProb = pU;
            marketOddsValue = oddsSnapshot ? (oddsSnapshot.awayOdds || 1.95) : 1.95;
          }
        }

        const ev = calibratedProb * marketOddsValue - 1.0;
        const rawKelly = ev > 0 && marketOddsValue > 1.0 ? ev / (marketOddsValue - 1.0) : 0.0;
        const finalWeight = rawKelly * 0.25; // default Quarter-Kelly

        // 3. Format structured local explainability JSON
        const explainability = ExplainabilityFormatter.generateExplanation({
          matchInfo: {
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            league: match.league,
            kickoff: match.kickoff
          },
          oddsInfo: {
            bookmaker: oddsSnapshot?.bookmaker || 'Pinnacle',
            odds: marketOddsValue,
            impliedProb: 1 / marketOddsValue,
            fairProb: 1 / marketOddsValue - 0.02 // mock fair odds removal
          },
          modelInfo: {
            calibratedProb,
            confidenceScore: predictionOutput.confidence?.confidenceScore || 75.0
          },
          calculations: {
            rawEdge: calibratedProb - (1 / marketOddsValue),
            expectedValue: ev,
            rawKelly,
            scaledKelly: finalWeight,
            finalWeight
          },
          inefficiencyReasons: ev > 0.05 ? ['Delayed soft market reaction to team form'] : []
        });

        // 4. Write immutable ledger entry
        const hash = await PredictionLedgerRepository.appendPrediction({
          match_id: match.id,
          model_id: model.model_id,
          market_type: marketType,
          selection,
          line: oddsSnapshot ? oddsSnapshot.line || null : null,
          raw_probability: rawProb,
          calibrated_probability: calibratedProb,
          market_odds: marketOddsValue,
          expected_value: ev,
          kelly_fraction: rawKelly,
          risk_adjusted_stake: finalWeight,
          feature_version: (features as MatchFeaturesWithVersion).featureVersion || 'basic-v1',
          feature_vector_snapshot: features,
          explainability_json: explainability,
          prediction_timestamp: match.kickoff
        });

        if (hash) {
          if (model.role === 'champion') {
            championHash = hash;
          } else {
            challengerHashes.push(hash);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[PredictionExecutionService] executeAndRecord failed:', message);
    }

    return { championHash, challengerHashes };
  }
}
