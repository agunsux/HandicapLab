// EPIC 39 — Data Quality Score Engine (0 - 100)
// Evaluates fixture dataset quality based on completeness, odds coverage, missing xG %,
// duplicate detection (0 tolerance), and integrity validation status.

export interface DataQualityInput {
  fixtureId: string;
  totalExpectedFields: number;
  totalPopulatedFields: number;
  bookmakerQuotesCount: number;
  expectedBookmakersCount: number;
  missingXgCount: number;
  totalXgMatchesCount: number;
  duplicateCount: number;
  integrityFailures: string[];
}

export interface DataQualityReport {
  fixtureId: string;
  qualityScore: number; // 0 - 100
  completenessPct: number;
  oddsCoveragePct: number;
  missingXgPct: number;
  duplicateCount: number;
  integrityStatus: 'PASS' | 'FAIL';
  integrityFailures: string[];
  summaryText: string;
}

export class DataQualityEngine {
  /** Compute 0-100 Data Quality Score */
  static evaluateQuality(input: DataQualityInput): DataQualityReport {
    const completenessPct = Number(((input.totalPopulatedFields / Math.max(1, input.totalExpectedFields)) * 100).toFixed(2));
    const oddsCoveragePct = Number(((input.bookmakerQuotesCount / Math.max(1, input.expectedBookmakersCount)) * 100).toFixed(2));
    const missingXgPct = Number(((input.missingXgCount / Math.max(1, input.totalXgMatchesCount)) * 100).toFixed(2));

    // Deductions for missing data or duplicates
    let score = (completenessPct * 0.40) + (oddsCoveragePct * 0.40) + (Math.max(0, 100 - missingXgPct * 5) * 0.20);
    
    // Strict zero-tolerance deduction for duplicates
    if (input.duplicateCount > 0) {
      score -= input.duplicateCount * 25;
    }

    // Deduction for integrity check failures
    if (input.integrityFailures.length > 0) {
      score -= input.integrityFailures.length * 15;
    }

    const qualityScore = Number(Math.min(100, Math.max(0, score)).toFixed(1));
    const integrityStatus: 'PASS' | 'FAIL' = (input.duplicateCount === 0 && input.integrityFailures.length === 0 && qualityScore >= 75) ? 'PASS' : 'FAIL';

    return {
      fixtureId: input.fixtureId,
      qualityScore,
      completenessPct,
      oddsCoveragePct,
      missingXgPct,
      duplicateCount: input.duplicateCount,
      integrityStatus,
      integrityFailures: input.integrityFailures,
      summaryText: `Data Quality ${qualityScore}/100 (${integrityStatus}). Completeness: ${completenessPct}%, Odds Coverage: ${oddsCoveragePct}%, Missing xG: ${missingXgPct}%, Duplicates: ${input.duplicateCount}.`,
    };
  }
}
