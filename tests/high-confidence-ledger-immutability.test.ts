// ============================================================================
// HIGH-CONFIDENCE LEDGER CONFIDENCE IMMUTABILITY REGRESSION TEST
// ============================================================================
// Validates:
// 1. Published signal confidence is stored 100% immutably in the ledger.
//    published_signal.confidence == ledger.prediction_snapshot.confidenceScore
//    (no rounding, normalization, or transformation).
// 2. Strict qualification boundary: confidence > 70.0 (70.0 is rejected, 70.01 is accepted).
// 3. Float confidence (e.g. 74.5) is preserved exactly as 74.5 in ledger snapshot.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { ProductionSignalDTO } from '@/lib/publishing/types';

describe('HighConfidenceLedgerService - Confidence Immutability & Gate Rule', () => {
  const nowMs = Date.now();
  const kickoffUtc = new Date(nowMs + 2 * 3600 * 1000).toISOString(); // 2 hours future
  const oddsTimestampUtc = new Date(nowMs - 300 * 1000).toISOString();
  const predictionTimestampUtc = new Date(nowMs - 60 * 1000).toISOString();

  beforeEach(() => {
    // Clear in-memory ledger store before each test
    DurableLedgerStore.saveLedger({});
  });

  function createMockSignal(confidence: number, idSuffix: string = '1'): ProductionSignalDTO {
    return {
      signalId: `sig_test_conf_${idSuffix}`,
      canonicalMatchId: `match_test_${idSuffix}`,
      fixtureId: `fix_test_${idSuffix}`,
      providerFixtureId: `pfix_${idSuffix}`,
      match: 'Arsenal vs Chelsea',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      competition: 'Premier League',
      leagueKey: 'ENG-PL',
      leagueTier: 'A',
      kickoffUtc,
      market: 'AH',
      selection: 'Arsenal -0.5',
      line: -0.5,
      currentOdds: 1.95,
      modelProbability: 0.58,
      marketProbability: 0.5128,
      edge: 0.0672,
      expectedValue: 0.131,
      fairOdds: 1.72,
      confidence,
      strengthLevel: 'STRONG',
      signalColor: 'green',
      confidenceDisclaimer: 'Confidence represents multi-factor model robustness and sample sufficiency.',
      publishState: 'PUBLISHED',
      validityStatus: 'VALID',
      rejectionReason: null,
      dataFreshnessSeconds: 300,
      freshnessText: '5m ago',
      predictionTimestampUtc,
      oddsTimestampUtc,
      lastReconciledUtc: new Date(nowMs).toISOString(),
      payloadHash: 'test_hash_' + idSuffix,
      providerProvenance: {
        fixtures: 'api-football-pro',
        odds: 'oddspapi-pinnacle',
        statistics: 'apifootball',
        modelVersion: 'dixon-coles-v1.0',
      },
    };
  }

  it('preserves exact float confidence (74.5% -> 74.5%) with zero transformation or display rounding', async () => {
    const publishedSignal = createMockSignal(74.5, '74_5');

    const result = await HighConfidenceLedgerService.qualifyAndRecordPrediction(publishedSignal, { nowMs });

    expect(result.qualified).toBe(true);
    expect(result.ledgerEntry).toBeDefined();

    const ledgerEntry = result.ledgerEntry!;
    // Strict Invariant: Exactly equal without rounding or conversion
    expect(ledgerEntry.confidenceScore).toBe(74.5);
    expect(ledgerEntry.confidenceScore).toBe(publishedSignal.confidence);
    expect(ledgerEntry.stakeUnits).toBe(1.0);
    expect(ledgerEntry.betType).toBe('VIRTUAL_RESEARCH');

    // Verify persisted record in DurableLedgerStore
    const stored = DurableLedgerStore.getEntry(ledgerEntry.ledgerId);
    expect(stored).toBeDefined();
    expect(stored?.confidenceScore).toBe(74.5);
    expect(stored?.confidenceScore).toBe(publishedSignal.confidence);
  });

  it('strictly rejects predictions with confidence <= 70.0 (qualification rule: confidence > 70)', async () => {
    // Exactly 70.0 must be rejected
    const boundarySignal = createMockSignal(70.0, '70_0');
    const boundaryResult = await HighConfidenceLedgerService.qualifyAndRecordPrediction(boundarySignal, { nowMs });
    expect(boundaryResult.qualified).toBe(false);
    expect(boundaryResult.rejectionReason).toContain('CONFIDENCE_NOT_QUALIFIED');
    expect(boundaryResult.ledgerEntry).toBeUndefined();

    // 69.9 must be rejected
    const subSignal = createMockSignal(69.9, '69_9');
    const subResult = await HighConfidenceLedgerService.qualifyAndRecordPrediction(subSignal, { nowMs });
    expect(subResult.qualified).toBe(false);
    expect(subResult.rejectionReason).toContain('CONFIDENCE_NOT_QUALIFIED');
    expect(subResult.ledgerEntry).toBeUndefined();
  });

  it('strictly accepts predictions with confidence > 70.0 (e.g. 70.01)', async () => {
    const qualifiedSignal = createMockSignal(70.01, '70_01');
    const result = await HighConfidenceLedgerService.qualifyAndRecordPrediction(qualifiedSignal, { nowMs });

    expect(result.qualified).toBe(true);
    expect(result.ledgerEntry).toBeDefined();
    expect(result.ledgerEntry?.confidenceScore).toBe(70.01);
    expect(result.ledgerEntry?.confidenceScore).toBe(qualifiedSignal.confidence);
  });
});
