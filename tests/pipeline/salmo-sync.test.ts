import { describe, it, expect, beforeEach } from 'vitest';
import { SalmoSyncService } from '@/lib/pipeline/salmoSyncService';
import { PredictionLedgerRecord } from '@/lib/pipeline/dailyPredictionLedger';

describe('Epic: Canonical Salmo Synchronization Service', () => {
  beforeEach(() => {
    SalmoSyncService.clearForTesting();
  });

  const makeRecord = (overrides: Partial<PredictionLedgerRecord> = {}): PredictionLedgerRecord => ({
    predictionId: 'pred_ah_1',
    canonicalMatchId: 'match_1',
    match: 'Arsenal vs Chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    market: 'AH',
    selection: 'Arsenal -0.5',
    line: -0.5,
    modelProbability: 0.69,
    calibratedProbability: 0.69,
    odds: 1.85,
    impliedProbability: 0.54,
    edge: 0.15,
    expectedValue: 0.28,
    confidence: 'HIGH',
    confidenceScore: 85,
    predictionTimestamp: new Date().toISOString(),
    kickoffTimestamp: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    oddsTimestamp: new Date().toISOString(),
    modelVersion: 'dixon-coles-v1.0',
    featureVersion: 'prematch-features-v1.0',
    runId: 'daily-2026-09-27T04:00Z',
    status: 'HIGH_CONFIDENCE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('synchronizes HIGH_CONFIDENCE AH predictions to Salmo with POTENTIAL_WINNING_BET status', async () => {
    const records = [makeRecord()];
    const report = await SalmoSyncService.synchronize(records);

    expect(report.status).toBe('SUCCESS');
    expect(report.totalHighConfidence).toBe(1);
    expect(report.created).toBe(1);
    expect(report.syncedDecisions.length).toBe(1);

    const card = report.syncedDecisions[0];
    expect(card.status).toBe('POTENTIAL_WINNING_BET');
    expect(card.confidence).toBe('HIGH');
    expect(card.match).toBe('Arsenal vs Chelsea');
    expect(card.odds).toBe(1.85);
    expect(card.modelProbabilityPct).toBe(69.0);
    expect(card.edgePct).toBe(15.0);
  });

  it('enforces probabilistic wording without deceptive labels', async () => {
    const records = [makeRecord()];
    const report = await SalmoSyncService.synchronize(records);
    const card = report.syncedDecisions[0];

    const fullText = JSON.stringify(card).toLowerCase();
    expect(fullText).not.toContain('guaranteed win');
    expect(fullText).not.toContain('sure win');
    expect(fullText).not.toContain('banker');
    expect(fullText).not.toContain('lock');

    expect(card.disclaimer).toContain('Probabilistic research signal');
  });

  it('NEVER synchronizes BTTS predictions even if status was erroneously set to HIGH_CONFIDENCE', async () => {
    const bttsRecord = makeRecord({
      market: 'BTTS',
      selection: 'BTTS Yes',
      line: 0,
      status: 'HIGH_CONFIDENCE',
    });

    const report = await SalmoSyncService.synchronize([bttsRecord]);
    expect(report.status).toBe('NO_PICKS');
    expect(report.created).toBe(0);
    expect(report.syncedDecisions.length).toBe(0);
    expect(report.rejected).toBe(1);
  });

  it('is idempotent: running sync twice does not duplicate decisions', async () => {
    const records = [makeRecord()];

    const report1 = await SalmoSyncService.synchronize(records);
    expect(report1.created).toBe(1);
    expect(report1.unchanged).toBe(0);

    const report2 = await SalmoSyncService.synchronize(records);
    expect(report2.created).toBe(0);
    expect(report2.unchanged).toBe(1);
  });

  it('handles simulated network timeout gracefully without throwing or blocking HandicapLab', async () => {
    const records = [makeRecord()];
    const report = await SalmoSyncService.synchronize(records, { simulateFailure: true });

    expect(report.status).toBe('SALMO_SYNC_FAILED');
    expect(report.errorMessage).toContain('SIMULATED_NETWORK_TIMEOUT');
    expect(report.syncedDecisions.length).toBe(0);
  });
});
