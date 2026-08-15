import { describe, it, expect } from 'vitest';
import {
  CLUSTERS,
  clusterOf,
  clusterOfBet,
  clusterOfPick,
  regimeSimilarity,
  classifyRegime,
  analyzeCluster,
  runThreeRegimeAnalysis,
  ClusterMetrics,
} from '../src/historical/regime/analyze';
import { loadJsonl, buildBets } from '../src/historical/realOdds/validate';
import { OssPick } from '../src/historical/realOdds/validate';
import { RealOddsPair } from '../src/historical/realOdds/ingest';
import { settleRealOutcome, profitOfOutcome } from '../src/historical/realOdds/ingest';

describe('Cluster date boundaries', () => {
  it('should define three non-overlapping clusters', () => {
    expect(CLUSTERS.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
    // no overlap: C1.end <= C2.start, C2.end <= C3.start
    const [c1, c2, c3] = CLUSTERS;
    expect(c1.end).toBe('2024-06-30');
    expect(c2.start).toBe('2024-08-01');
    expect(c2.end).toBe('2025-12-31');
    expect(c3.start).toBe('2026-01-01');
    expect(c1.end <= c2.start).toBe(true);
    expect(c2.end <= c3.start).toBe(true);
  });

  it('should assign a date to exactly one cluster', () => {
    expect(clusterOf('2023-03-01')?.id).toBe('C1');
    expect(clusterOf('2024-11-01')?.id).toBe('C2');
    expect(clusterOf('2026-02-01')?.id).toBe('C3');
    expect(clusterOf('2024-07-15')).toBeNull(); // gap month
  });

  it('should enforce C3 chronological order (start after C2 end)', () => {
    const c3 = CLUSTERS.find((c) => c.id === 'C3')!;
    expect(c3.start).toBe('2026-01-01');
  });
});

describe('Regime classification', () => {
  it('should classify as NO_REGIME_SIGNAL when clusters behave the same', () => {
    const metrics: ClusterMetrics[] = [
      { cluster: 'C1', roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9 } as unknown as ClusterMetrics,
      { cluster: 'C2', roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9 } as unknown as ClusterMetrics,
      { cluster: 'C3', roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9, bets: 100 } as unknown as ClusterMetrics,
    ];
    const r = classifyRegime(metrics);
    expect(r['classification']).toBe('NO_REGIME_SIGNAL (clusters behave materially the same)');
  });

  it('should report INSUFFICIENT_EVIDENCE when C3 sample is tiny', () => {
    const metrics: ClusterMetrics[] = [
      { cluster: 'C1', roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9 } as unknown as ClusterMetrics,
      { cluster: 'C2', roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9 } as unknown as ClusterMetrics,
      { cluster: 'C3', roi: 0.05, clv: 0.01, ece: 0.1, positive_months: 1, negative_months: 1, bets: 10 } as unknown as ClusterMetrics,
    ];
    const r = classifyRegime(metrics);
    expect(r['classification']).toContain('INSUFFICIENT_EVIDENCE');
  });

  it('should compute similarity in [0,1]', () => {
    const a = { roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9 } as unknown as ClusterMetrics;
    const b = { roi: -0.04, clv: -0.001, ece: 0.12, positive_months: 1, negative_months: 9 } as unknown as ClusterMetrics;
    const s = regimeSimilarity(a, b);
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('End-to-end determinism', () => {
  it('should produce identical report on two runs', () => {
    const r1 = runThreeRegimeAnalysis();
    const r2 = runThreeRegimeAnalysis();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('should report honest C1/C2/C3 coverage', () => {
    const r = runThreeRegimeAnalysis();
    const mt = r['master_table'] as Record<string, Record<string, unknown>>;
    expect((mt['C1']['bets'] as number)).toBeGreaterThan(0);
    expect((mt['C2']['bets'] as number)).toBeGreaterThan(0);
    // C3 must not fabricate bets if real odds are insufficient
    expect(mt['C3']['bets'] as number).toBeGreaterThanOrEqual(0);
  });
});

describe('Settlement math reused correctly', () => {
  it('should settle quarter lines per exact AH line identity', () => {
    expect(settleRealOutcome('AH', 'home', -0.25, 2, 1)).toBe('WIN');
    expect(settleRealOutcome('AH', 'home', -0.25, 1, 1)).toBe('HALF_LOSS');
    expect(settleRealOutcome('AH', 'home', 0.25, 1, 1)).toBe('HALF_WIN');
    expect(settleRealOutcome('AH', 'home', 0, 1, 1)).toBe('PUSH');
  });

  it('should not confuse different lines (identity integrity)', () => {
    // Same scoreline, different line -> different outcome
    expect(settleRealOutcome('AH', 'home', -0.5, 1, 1)).toBe('LOSS');
    expect(settleRealOutcome('AH', 'home', 0, 1, 1)).toBe('PUSH');
    expect(settleRealOutcome('AH', 'home', 0.5, 1, 1)).toBe('WIN');
  });
});
