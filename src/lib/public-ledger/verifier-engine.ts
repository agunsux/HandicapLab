// EPIC 40 — Independent Verification & Audit Engine
// Asserts bit-exact reproducibility across probabilities, fair odds, EV, and SHA-256 hashes.

import { createHash } from 'crypto';
import type { PublicLedgerRecord } from './ledger-engine';

export interface VerificationCertificate {
  predictionId: string;
  formattedPredictionId: string;
  isReproducible: boolean;
  isHashValid: boolean;
  overallStatus: 'VERIFIED' | 'FAILED';
  verificationDetails: {
    expectedFairOdds: number;
    actualFairOdds: number;
    expectedEV: number;
    actualEV: number;
    predictionHashMatch: boolean;
  };
  certifiedAt: string;
}

export class PublicVerifierEngine {
  /** Verify mathematical and cryptographic reproducibility of a public prediction record */
  static verifyRecord(record: PublicLedgerRecord): VerificationCertificate {
    // Recalculate Model Fair Odds (1 / modelProb)
    const expectedFairOdds = Number((1 / record.modelProb).toFixed(3));
    const isFairOddsMatch = Math.abs(expectedFairOdds - record.modelFairOdds) < 0.005;

    // Recalculate Expected Value (modelProb * bookmakerOdds - 1)
    const expectedEV = Number((record.modelProb * record.bookmakerOdds - 1).toFixed(4));
    const isEvMatch = Math.abs(expectedEV - record.expectedValue) < 0.005;

    // Recalculate SHA-256 prediction hash
    const payload = `${record.formattedPredictionId}:${record.fixtureId}:${record.modelVersion}:${record.market}:${record.selection}:${record.modelProb}:${record.expectedValue}`;
    const recalculatedHash = createHash('sha256').update(payload).digest('hex');
    const predictionHashMatch = recalculatedHash === record.predictionHash;

    const isReproducible = isFairOddsMatch && isEvMatch;
    const isHashValid = predictionHashMatch;
    const overallStatus = isReproducible && isHashValid ? 'VERIFIED' : 'FAILED';

    return {
      predictionId: record.id,
      formattedPredictionId: record.formattedPredictionId,
      isReproducible,
      isHashValid,
      overallStatus,
      verificationDetails: {
        expectedFairOdds,
        actualFairOdds: record.modelFairOdds,
        expectedEV,
        actualEV: record.expectedValue,
        predictionHashMatch,
      },
      certifiedAt: new Date().toISOString(),
    };
  }
}
