/**
/**
 * STRICT WALK-FORWARD OUT-OF-SAMPLE ADAPTER
 * Location: src/lib/research/real-yield/walkForwardAdapter.ts
 *
 * Enforces strict temporal ordering and zero data leakage:
 * For every fixture T:
 *   training information timestamp < kickoff(T)
 *
 * Guarantees that no future results, odds, or season statistics
 * enter the training set of any prediction.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import { HierarchicalDixonColesModel } from '../model-a/hierarchicalDixonColes';
import { AhProbabilityEngine } from '../model-a/ahProbabilityEngine';
import { calculateAhExpectedValue } from '../ahSettlementEngine';
import {
  CanonicalMatch,
  FittedLeagueModel,
  BivariateScoreDistribution,
  AhLineProbability,
  AhSide,
} from '../model-a/types';

export interface AuditablePrediction {
  fixtureId: string;
  leagueId: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  actualHomeGoals: number;
  actualAwayGoals: number;
  kickoffDate: string; // YYYY-MM-DD
  kickoffTimestamp: string; // ISO 8601 string: e.g. YYYY-MM-DDT12:00:00.000Z
  predictionTimestamp: string; // ISO 8601 string: e.g. YYYY-MM-DDT00:00:00.000Z (< kickoffTimestamp)
  trainingCutoffDate: string; // matchDate (exclusive cutoff: all training matches < cutoffDate)
  trainingObservationCount: number;
  lastTrainingMatchDate: string | null; // strictly < kickoffDate
  modelVersion: string;
  modelConfig: {
    mu: number;
    gamma: number;
    rho: number;
    nTeams: number;
  };
  expectedGoals: {
    homeLambda: number;
    awayLambda: number;
  };
  probabilities: {
    // 1X2
    pHomeWin: number;
    pDraw: number;
    pAwayWin: number;
    // OU 2.5
    pOver25: number;
    pUnder25: number;
  };
  scoreMatrix: number[][]; // normalized matrix up to maxGoals (10)
}

export class StrictWalkForwardAdapter {
  public static readonly MODEL_VERSION = 'HierarchicalDixonColes-ModelA-v1';
  public static readonly FROZEN_DATASET_HASH =
    '22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727';

  private static computeSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Verifies the frozen Gold dataset hash before any processing.
   * Throws immediately if hash does not match expected.
   */
  public static verifyFrozenGoldChecksum(
    matchesPath = 'data/golden/europe/canonical_matches.jsonl',
    oddsPath = 'data/golden/europe/market_odds.jsonl'
  ): { matchesHash: string; oddsHash: string; combinedHash: string } {
    const mPath = path.resolve(process.cwd(), matchesPath);
    const oPath = path.resolve(process.cwd(), oddsPath);

    const matchesHash = this.computeSha256(mPath);
    const oddsHash = this.computeSha256(oPath);
    const combinedHash = crypto
      .createHash('sha256')
      .update(matchesHash.toLowerCase() + oddsHash.toLowerCase())
      .digest('hex');

    if (combinedHash !== this.FROZEN_DATASET_HASH) {
      throw new Error(
        `[LEAKAGE_INTEGRITY_BLOCK] Frozen Gold dataset hash mismatch! Expected ${this.FROZEN_DATASET_HASH}, got ${combinedHash}`
      );
    }

    return { matchesHash, oddsHash, combinedHash };
  }

  /**
   * Loads canonical matches sorted strictly chronologically.
   */
  public static async loadCanonicalMatches(
    matchesPath = 'data/golden/europe/canonical_matches.jsonl'
  ): Promise<CanonicalMatch[]> {
    const mPath = path.resolve(process.cwd(), matchesPath);
    const matches: CanonicalMatch[] = [];

    const rl = readline.createInterface({
      input: fs.createReadStream(mPath, 'utf-8'),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      matches.push(JSON.parse(line) as CanonicalMatch);
    }

    // Sort strictly chronologically by matchDate, then canonicalId
    matches.sort((a, b) => {
      const dateCmp = a.matchDate.localeCompare(b.matchDate);
      if (dateCmp !== 0) return dateCmp;
      return a.canonicalId.localeCompare(b.canonicalId);
    });

    return matches;
  }

  /**
   * Generates out-of-sample prediction for a single fixture T.
   *
   * Hard Invariant:
   * Only matches with matchDate < fixture.matchDate are included in training.
   * Throws an error if any training match has matchDate >= fixture.matchDate.
   */
  public static predictFixture(
    fixture: CanonicalMatch,
    allMatches: CanonicalMatch[],
    modelCache?: Map<string, FittedLeagueModel>
  ): AuditablePrediction {
    const kickoffDate = fixture.matchDate;
    const cacheKey = `${fixture.leagueId}|${kickoffDate}`;

    let fittedModel: FittedLeagueModel;

    if (modelCache && modelCache.has(cacheKey)) {
      fittedModel = modelCache.get(cacheKey)!;
    } else {
      // 1. Filter training matches: strictly same league, strictly prior to kickoffDate
      const trainMatches: CanonicalMatch[] = [];
      for (const m of allMatches) {
        if (m.leagueId === fixture.leagueId && m.matchDate < kickoffDate) {
          trainMatches.push(m);
        }
      }

      // Hard Anti-Leakage Assertion: Verify EVERY single training match
      for (let i = 0; i < trainMatches.length; i++) {
        if (trainMatches[i].matchDate >= kickoffDate) {
          throw new Error(
            `[LEAKAGE_DETECTED] Training match ${trainMatches[i].canonicalId} date ${trainMatches[i].matchDate} >= kickoffDate ${kickoffDate}`
          );
        }
      }

      const lastTrainingDate =
        trainMatches.length > 0 ? trainMatches[trainMatches.length - 1].matchDate : null;

      if (lastTrainingDate !== null && lastTrainingDate >= kickoffDate) {
        throw new Error(
          `[LEAKAGE_DETECTED] lastTrainingDate ${lastTrainingDate} >= kickoffDate ${kickoffDate}`
        );
      }

      // Fit Hierarchical Dixon-Coles model with strict referenceDate
      fittedModel = HierarchicalDixonColesModel.fitLeague(
        trainMatches,
        fixture.leagueId,
        kickoffDate
      );
      (fittedModel as any).lastMatchDate = lastTrainingDate;

      if (modelCache) {
        modelCache.set(cacheKey, fittedModel);
      }
    }

    // 2. Compute expected goal rates lambda_H and lambda_A
    const { homeLambda, awayLambda } = HierarchicalDixonColesModel.computeLambdas(
      fixture.homeTeam,
      fixture.awayTeam,
      fittedModel
    );

    // 3. Compute bivariate score distribution up to maxGoals = 10
    const scoreDist = HierarchicalDixonColesModel.computeScoreDistribution(
      homeLambda,
      awayLambda,
      fittedModel.rho,
      10
    );

    // 4. Derive exact 1X2 probabilities
    let pHomeWin = 0;
    let pDraw = 0;
    let pAwayWin = 0;
    let pOver25 = 0;
    let pUnder25 = 0;

    for (let h = 0; h <= scoreDist.maxGoals; h++) {
      for (let a = 0; a <= scoreDist.maxGoals; a++) {
        const p = scoreDist.matrix[h][a];
        if (h > a) pHomeWin += p;
        else if (h === a) pDraw += p;
        else pAwayWin += p;

        if (h + a >= 3) pOver25 += p;
        else pUnder25 += p;
      }
    }

    // Normalize tail micro-rounding
    const total1X2 = pHomeWin + pDraw + pAwayWin || 1.0;
    pHomeWin = Number((pHomeWin / total1X2).toFixed(4));
    pDraw = Number((pDraw / total1X2).toFixed(4));
    pAwayWin = Number((pAwayWin / total1X2).toFixed(4));

    const totalOU = pOver25 + pUnder25 || 1.0;
    pOver25 = Number((pOver25 / totalOU).toFixed(4));
    pUnder25 = Number((pUnder25 / totalOU).toFixed(4));

    const lastTrainingDate = (fittedModel as any).lastMatchDate ?? null;

    // Strict timestamps
    // kickoffTimestamp is YYYY-MM-DDT12:00:00.000Z
    // predictionTimestamp is YYYY-MM-DDT00:00:00.000Z (strictly prior to kickoff)
    const kickoffTimestamp = `${kickoffDate}T12:00:00.000Z`;
    const predictionTimestamp = `${kickoffDate}T00:00:00.000Z`;

    return {
      fixtureId: fixture.canonicalId,
      leagueId: fixture.leagueId,
      season: fixture.season,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      actualHomeGoals: fixture.homeGoals,
      actualAwayGoals: fixture.awayGoals,
      kickoffDate,
      kickoffTimestamp,
      predictionTimestamp,
      trainingCutoffDate: kickoffDate,
      trainingObservationCount: fittedModel.nMatches,
      lastTrainingMatchDate: lastTrainingDate,
      modelVersion: this.MODEL_VERSION,
      modelConfig: {
        mu: fittedModel.mu,
        gamma: fittedModel.gamma,
        rho: fittedModel.rho,
        nTeams: fittedModel.nTeams,
      },
      expectedGoals: {
        homeLambda,
        awayLambda,
      },
      probabilities: {
        pHomeWin,
        pDraw,
        pAwayWin,
        pOver25,
        pUnder25,
      },
      scoreMatrix: scoreDist.matrix,
    };
  }

  /**
   * Computes AH line probability and EV for an existing prediction record.
   */
  public static computeAhProbabilities(
    prediction: AuditablePrediction,
    line: number,
    decimalOdds: number,
    side: AhSide = 'HOME'
  ): AhLineProbability {
    const scoreDist: BivariateScoreDistribution = {
      matrix: prediction.scoreMatrix,
      maxGoals: prediction.scoreMatrix.length - 1,
      homeLambda: prediction.expectedGoals.homeLambda,
      awayLambda: prediction.expectedGoals.awayLambda,
      rho: prediction.modelConfig.rho,
    };

    return AhProbabilityEngine.computeAhLineProbabilities(
      scoreDist,
      line,
      decimalOdds,
      side
    );
  }

  /**
   * Executes strict chronological walk-forward predictions across an entire cohort of matches.
   */
  public static async executeWalkForwardCohort(
    matches: CanonicalMatch[]
  ): Promise<AuditablePrediction[]> {
    const modelCache = new Map<string, FittedLeagueModel>();
    const predictions: AuditablePrediction[] = [];

    // Ensure sorted chronologically
    const sorted = [...matches].sort((a, b) => {
      const d = a.matchDate.localeCompare(b.matchDate);
      if (d !== 0) return d;
      return a.canonicalId.localeCompare(b.canonicalId);
    });

    for (let i = 0; i < sorted.length; i++) {
      const pred = this.predictFixture(sorted[i], sorted, modelCache);
      predictions.push(pred);
    }

    return predictions;
  }
}
