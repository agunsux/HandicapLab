// EPIC 37 — Layer 1: Immutable Forecast Archive & Settlement Engine
// Archives immutable predictions with cryptographic hashes and appends settlement outcomes.

import { createHash } from 'crypto';

export interface ForecastRecordInput {
  fixtureId: string;
  modelVersion: string;
  featureVersion: string;
  league: string;
  market: string;
  selection: string;
  probability: number;
  ciLower: number;
  ciUpper: number;
  modelFairOdds: number;
  bookmakerOdds: number;
  probEdge: number;
  expectedValue: number;
  kellyFraction: number;
  recommendation: string;
  confidence: number;
  featureVector: Record<string, number>;
}

export interface ArchivedForecastRecord extends ForecastRecordInput {
  id: string;
  ciWidth: number;
  featureVectorHash: string;
  predictionHash: string;
  createdAt: string;
}

export interface SettlementRecord {
  forecastId: string;
  closingOdds: number;
  closingProb: number;
  result: 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS';
  profit: number;
  clv: number;
  realizedRoi: number;
  drawdownState: number;
  settledAt: string;
}

export class ForecastArchiveEngine {
  /** Create immutable archived prediction payload */
  static archiveForecast(input: ForecastRecordInput): ArchivedForecastRecord {
    const ciWidth = Number((input.ciUpper - input.ciLower).toFixed(4));
    
    // Generate cryptographic feature vector hash
    const featureVectorHash = createHash('sha256')
      .update(JSON.stringify(input.featureVector))
      .digest('hex');

    // Generate prediction hash
    const predictionPayload = `${input.fixtureId}:${input.modelVersion}:${input.market}:${input.selection}:${input.probability}:${input.expectedValue}`;
    const predictionHash = createHash('sha256')
      .update(predictionPayload)
      .digest('hex');

    return {
      ...input,
      id: `fc-${input.fixtureId}-${input.market}-${input.selection}`,
      ciWidth,
      featureVectorHash,
      predictionHash,
      createdAt: new Date().toISOString(),
    };
  }

  /** Compute settlement metrics when fixture finishes */
  static settleForecast(
    archived: ArchivedForecastRecord,
    closingOdds: number,
    result: 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS',
    stakeUnits: number = 1.0
  ): SettlementRecord {
    const closingProb = Number((1 / closingOdds).toFixed(4));
    const clv = Number(((archived.bookmakerOdds / closingOdds) - 1).toFixed(4));

    let profit = 0;
    if (result === 'WIN') profit = (archived.bookmakerOdds - 1) * stakeUnits;
    else if (result === 'LOSS') profit = -stakeUnits;
    else if (result === 'HALF_WIN') profit = ((archived.bookmakerOdds - 1) / 2) * stakeUnits;
    else if (result === 'HALF_LOSS') profit = (-stakeUnits / 2);

    const realizedRoi = Number((profit / stakeUnits).toFixed(4));
    const drawdownState = profit < 0 ? Math.abs(profit) : 0;

    return {
      forecastId: archived.id,
      closingOdds,
      closingProb,
      result,
      profit: Number(profit.toFixed(4)),
      clv,
      realizedRoi,
      drawdownState,
      settledAt: new Date().toISOString(),
    };
  }
}
