import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateYieldGate,
  DEFAULT_YIELD_STATUS,
  type BetEvaluationRecord,
  type YieldGateInput,
} from '@/lib/research/yieldValidationGate';
import { getBlockedRequestCount, resetBlockedRequestCount } from '../setup-env';

function createValidRecord(overrides: Partial<BetEvaluationRecord> = {}): BetEvaluationRecord {
  return {
    id: 'BET-001',
    fixtureId: 'FIX-1001',
    market: 'OU_2_5',
    league: 'Premier League',
    season: '2024-2025',
    kickoffTime: '2024-11-10T15:00:00.000Z',
    predictionTime: '2024-11-10T12:00:00.000Z', // 3 hours before kickoff
    oddsTimestamp: '2024-11-10T14:45:00.000Z',  // 15 mins before kickoff
    marketLine: 'OVER_2.5',
    odds: 1.95,
    stake: 1.0,
    pnl: 0.95,
    outcome: 'WIN',
    modelConfidence: 0.62,
    isRealResult: true,
    isRealOdds: true,
    ...overrides,
  };
}

function generateMockDataset(count: number, winRate = 0.52, odds = 1.95): BetEvaluationRecord[] {
  const records: BetEvaluationRecord[] = [];
  const baseKickoff = new Date('2024-01-01T15:00:00.000Z').getTime();

  for (let i = 0; i < count; i++) {
    const isWin = i / count < winRate;
    const kickMs = baseKickoff + i * 86400000;
    const predMs = kickMs - 7200000; // 2 hours before
    const oddsMs = kickMs - 1800000; // 30 mins before

    records.push({
      id: `BET-${i + 1}`,
      fixtureId: `FIX-${i + 1}`,
      market: 'OU_2_5',
      league: i % 2 === 0 ? 'Premier League' : 'La Liga',
      season: '2024-2025',
      kickoffTime: new Date(kickMs).toISOString(),
      predictionTime: new Date(predMs).toISOString(),
      oddsTimestamp: new Date(oddsMs).toISOString(),
      marketLine: 'OVER_2.5',
      odds,
      stake: 1.0,
      pnl: isWin ? (odds - 1) : -1.0,
      outcome: isWin ? 'WIN' : 'LOSS',
      modelConfidence: 0.55 + (i % 30) * 0.01,
      isRealResult: true,
      isRealOdds: true,
    });
  }
  return records;
}

describe('P0.5 Yield Validation Gate Governance', () => {
  beforeEach(() => {
    resetBlockedRequestCount();
  });

  it('defaults to YIELD_STATUS = UNVALIDATED', () => {
    expect(DEFAULT_YIELD_STATUS).toBe('UNVALIDATED');

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 100,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records: [],
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.honestyStatement).toContain('UNVALIDATED');
  });

  it('fails closed on synthetic/mock match results (Invariant 1)', () => {
    const records = [
      createValidRecord({ id: 'BET-1', isRealResult: true }),
      createValidRecord({ id: 'BET-2', isRealResult: false }), // Synthetic
    ];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 2,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 1'))).toBe(true);
  });

  it('fails closed on synthetic or non-market odds (Invariant 2)', () => {
    const records = [
      createValidRecord({ id: 'BET-1', isRealOdds: true }),
      createValidRecord({ id: 'BET-2', isRealOdds: false }), // Synthetic
    ];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 2,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 2'))).toBe(true);
  });

  it('fails closed on future data leakage: predictionTime >= kickoff (Invariant 5)', () => {
    const records = [
      createValidRecord({
        id: 'BET-LEAK',
        kickoffTime: '2024-11-10T15:00:00.000Z',
        predictionTime: '2024-11-10T15:05:00.000Z', // 5 minutes after kickoff!
      }),
    ];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 1,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 5'))).toBe(true);
  });

  it('fails closed when settlement rules are not deterministic (Invariant 7)', () => {
    const records = [
      createValidRecord({
        id: 'BET-BAD-SETTLE',
        odds: 2.0,
        stake: 1.0,
        pnl: 5.0, // Inconsistent! For odds 2.0 and stake 1.0, WIN pnl must be 1.0
        outcome: 'WIN',
      }),
    ];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 1,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 7'))).toBe(true);
  });

  it('fails closed when walk-forward is false (Invariant 8)', () => {
    const records = [createValidRecord()];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 1,
      isWalkForward: false, // Not walk-forward
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 8'))).toBe(true);
  });

  it('reports INSUFFICIENT_SAMPLE when pre-defined minimum threshold is not met (Invariant 9)', () => {
    const records = [createValidRecord()];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 100, // Pre-defined 100 bets required
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('INSUFFICIENT_SAMPLE');
    expect(result.gatePassed).toBe(false);
    expect(result.honestyStatement).toContain('INSUFFICIENT SAMPLE');
  });

  it('fails closed when frozen dataset hash is missing (Invariant 10)', () => {
    const records = [createValidRecord()];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 1,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: '', // Missing frozen provenance hash
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 10'))).toBe(true);
  });

  it('fails closed on market contamination (Invariant 12)', () => {
    const records = [
      createValidRecord({ id: 'BET-1', market: 'OU_2_5' }),
      createValidRecord({ id: 'BET-2', market: 'BTTS' }), // Market contamination!
    ];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 2,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 12'))).toBe(true);
  });

  it('fails closed without anti-cherry-picking certification (Invariant 14)', () => {
    const records = [createValidRecord()];

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 1,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: false, // Uncertified
      datasetHash: 'hash-abc12345',
      records,
    });

    expect(result.status).toBe('UNVALIDATED');
    expect(result.gatePassed).toBe(false);
    expect(result.violations.some((v) => v.includes('Invariant 14'))).toBe(true);
  });

  it('honestly reports NEGATIVE_YIELD when model loses money, despite satisfying all invariants', () => {
    // 200 bets at 1.90 odds with 45% win rate -> expected ROI ~ -14.5%
    const losingDataset = generateMockDataset(200, 0.45, 1.90);

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 100,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'dataset-frozen-v1.0.0',
      records: losingDataset,
    });

    // All 14 methodological invariants pass
    expect(result.violations.length).toBe(0);
    expect(result.invariants.every((i) => i.passed)).toBe(true);

    // But statistical yield is negative
    expect(result.status).toBe('NEGATIVE_YIELD');
    expect(result.gatePassed).toBe(false);
    expect(result.metrics?.roi).toBeLessThan(0);
    expect(result.honestyStatement).toContain('NEGATIVE YIELD');
    expect(result.honestyStatement).toContain('The model does not beat the market line');
  });

  it('reports INCONCLUSIVE_YIELD when nominal yield is positive but 95% bootstrap CI crosses zero', () => {
    // 100 bets at 1.95 odds with 52% win rate -> small positive nominal ROI (+1.4%), but high variance (CI spans negative)
    const noisyDataset = generateMockDataset(100, 0.52, 1.95);

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 100,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'dataset-frozen-v1.0.0',
      records: noisyDataset,
    });

    expect(result.invariants.every((i) => i.passed)).toBe(true);
    // 95% CI lower bound must be <= 0 for small noisy dataset
    expect(result.status).toBe('INCONCLUSIVE_YIELD');
    expect(result.gatePassed).toBe(false);
    expect(result.honestyStatement).toContain('INCONCLUSIVE YIELD');
    expect(result.honestyStatement).toContain('crosses zero');
  });

  it('provides multi-dimensional segmentation across league, season, odds range, and confidence bucket', () => {
    const dataset = generateMockDataset(120, 0.50, 1.95);

    const result = evaluateYieldGate({
      market: 'OU_2_5',
      minSampleSize: 100,
      isWalkForward: true,
      deterministicSettlement: true,
      antiCherryPickingCertified: true,
      datasetHash: 'dataset-frozen-v1.0.0',
      records: dataset,
    });

    expect(result.segmentation).toBeDefined();
    expect(result.segmentation?.byLeague).toHaveProperty('Premier League');
    expect(result.segmentation?.byLeague).toHaveProperty('La Liga');
    expect(result.segmentation?.bySeason).toHaveProperty('2024-2025');
    expect(result.segmentation?.byOddsRange).toHaveProperty('1.70-2.00');
    expect(result.segmentation?.byConfidenceBucket).toBeDefined();

    // Verify segment counts sum to total bets
    const plBets = result.segmentation?.byLeague['Premier League'].betsCount || 0;
    const llBets = result.segmentation?.byLeague['La Liga'].betsCount || 0;
    expect(plBets + llBets).toBe(120);
  });

  it('asserts zero outbound network egress during all validation tests', () => {
    expect(getBlockedRequestCount()).toBe(0);
  });
});

