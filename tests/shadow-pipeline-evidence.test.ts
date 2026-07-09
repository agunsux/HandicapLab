// Shadow Pipeline Tests 2/2 — Evidence Chain, Evaluation Metrics
import { describe, it, expect } from 'vitest';
import { createEvidenceEntry, MemoryEvidenceLedgerStore } from '../src/lib/data/evidence/ledger';
import { evaluateEvidence, evaluateWindows } from '../src/lib/data/evaluation/runner';


function pred(id = 'p1') {
  return { id, fixtureId: 'f1', modelVersion: 'v1', modelHash: 'h', marketType: 'moneyline' as const, selection: 'home' as const, line: 0, predictionProb: 0.5, marketProb: 0.45, edge: 0.05, expectedValue: 0, confidence: 0.8, oddsSnapshotId: 'o1', inputDataHash: 'd', featureVersion: 'v1', datasetVersion: 'v1', timestamp: new Date() };
}
function settle() {
  return { id: 's1', predictionId: 'p1', fixtureId: 'f1', modelVersion: 'v1', marketType: 'moneyline' as const, selection: 'home' as const, line: 0, oddsAtSettlement: 2.0, actualOutcome: 1, profit: 1, roi: 1, clv: 0.05, settledAt: new Date(), isSettled: true };
}

describe('Evidence Chain Validation', () => {
  it('first entry has genesis null previousEntryId', () => {
    const e = createEvidenceEntry(pred(), null, null, 'PREDICTION_CREATED');
    expect(e.previousEntryId).toBeNull();
    expect(e.chainHash).toBeTruthy();
  });

  it('chain integrity valid with 2 linked entries', async () => {
    const store = new MemoryEvidenceLedgerStore();
    const e1 = createEvidenceEntry(pred('p1'), null, null, 'PREDICTION_CREATED');
    const e2 = createEvidenceEntry(pred('p2'), null, e1.id, 'MATCH_SETTLED');
    await store.append(e1); await store.append(e2);
    expect((await store.verifyChainIntegrity()).valid).toBe(true);
  });

  it('tampered entry breaks chain', async () => {
    const store = new MemoryEvidenceLedgerStore();
    const e1 = createEvidenceEntry(pred('p1'), null, null, 'PREDICTION_CREATED');
    await store.append(e1);
    e1.edge = 0.99; // manual tamper
    await store.append(e1);
    expect((await store.verifyChainIntegrity()).valid).toBe(false);
  });

  it('event types are stored correctly', () => {
    const e1 = createEvidenceEntry(pred(), null, null, 'PREDICTION_CREATED');
    expect(e1.eventType).toBe('PREDICTION_CREATED');
    const e2 = createEvidenceEntry(pred(), null, null, 'MATCH_SETTLED');
    expect(e2.eventType).toBe('MATCH_SETTLED');
  });
});

describe('Evaluation Metrics', () => {
  it('empty → zero structure', () => {
    const r = evaluateEvidence([], 'test', 10);
    expect(r.settledPredictions).toBe(0);
    expect(r.meetsMinimum).toBe(false);
    expect(r.marketBreakdown).toEqual([]);
  });

  it('evaluation includes marketBreakdown', () => {
    const entry = createEvidenceEntry(pred(), settle(), null, 'PREDICTION_CREATED');
    const r = evaluateEvidence([entry], 'test', 1);
    expect(r.marketBreakdown).toBeDefined();
    expect(r.meetsMinimum).toBe(true);
    expect(r.settledPredictions).toBe(1);
  });

  it('multi-window evaluation works', () => {
    const entry = createEvidenceEntry(pred(), settle(), null, 'PREDICTION_CREATED');
    const results = evaluateWindows([entry]);
    expect(Array.isArray(results)).toBe(true);

    expect(results.length).toBeGreaterThan(0);
  });
});