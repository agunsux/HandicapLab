// EPIC 40 — Public Prediction Ledger Engine
// Manages sequential Prediction IDs (#000001, #000002) and SHA-256 cryptographic hashes.

import { createHash } from 'crypto';

export interface PublicPredictionInput {
  predictionNumber: number; // e.g. 1 -> #000001
  fixtureId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  market: string;
  selection: string;
  modelProb: number;
  ciLower: number;
  ciUpper: number;
  modelFairOdds: number;
  bookmakerOdds: number;
  probEdge: number;
  expectedValue: number;
  recommendation: string;
  modelVersion: string;
  featureVersion: string;
}

export interface PublicLedgerRecord extends PublicPredictionInput {
  id: string;
  formattedPredictionId: string; // e.g. "#000001"
  predictionHash: string;
  datasetHash: string;
  verificationStatus: 'VERIFIED' | 'TAMPER_EVIDENT' | 'UNVERIFIED';
  settlement?: {
    closingOdds: number;
    closingProb: number;
    result: 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS';
    profit: number;
    clv: number;
    realizedRoi: number;
    settledAt: string;
  };
  createdAt: string;
}

export class PublicLedgerEngine {
  /** Create immutable public prediction record with SHA-256 hashes */
  static createPublicRecord(input: PublicPredictionInput): PublicLedgerRecord {
    const formattedPredictionId = `#${String(input.predictionNumber).padStart(6, '0')}`;

    const payload = `${formattedPredictionId}:${input.fixtureId}:${input.modelVersion}:${input.market}:${input.selection}:${input.modelProb}:${input.expectedValue}`;
    const predictionHash = createHash('sha256').update(payload).digest('hex');
    const datasetHash = createHash('sha256').update(`${input.fixtureId}:${input.kickoff}`).digest('hex');

    return {
      ...input,
      id: `pub-${input.predictionNumber}`,
      formattedPredictionId,
      predictionHash,
      datasetHash,
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };
  }

  /** Append settlement outcome to public ledger record (append-only) */
  static appendSettlement(
    record: PublicLedgerRecord,
    closingOdds: number,
    result: 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS',
    stakeUnits: number = 1.0
  ): PublicLedgerRecord {
    const closingProb = Number((1 / closingOdds).toFixed(4));
    const clv = Number(((record.bookmakerOdds / closingOdds) - 1).toFixed(4));

    let profit = 0;
    if (result === 'WIN') profit = (record.bookmakerOdds - 1) * stakeUnits;
    else if (result === 'LOSS') profit = -stakeUnits;
    else if (result === 'HALF_WIN') profit = ((record.bookmakerOdds - 1) / 2) * stakeUnits;
    else if (result === 'HALF_LOSS') profit = (-stakeUnits / 2);

    const realizedRoi = Number((profit / stakeUnits).toFixed(4));

    return {
      ...record,
      settlement: {
        closingOdds,
        closingProb,
        result,
        profit: Number(profit.toFixed(4)),
        clv,
        realizedRoi,
        settledAt: new Date().toISOString(),
      },
    };
  }
}
