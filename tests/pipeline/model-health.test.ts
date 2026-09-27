import { describe, it, expect } from 'vitest';
import { ModelHealthService, SettlementObservation } from '@/lib/pipeline/modelHealth';

describe('Epic: Model Health & Performance Tracking', () => {
  const sampleObservations: SettlementObservation[] = [
    {
      predictionId: 'pred_1',
      canonicalMatchId: 'match_1',
      market: 'AH',
      selection: 'Arsenal -0.5',
      line: -0.5,
      predictedProbability: 0.70,
      odds: 1.85,
      closingOdds: 1.80, // CLV = +2.78%
      outcome: 'WIN',
      profitUnits: 0.85,
      settledAt: '2026-09-26T22:00:00Z',
      kickoffUtc: '2026-09-26T15:00:00Z',
      isHighConfidence: true,
    },
    {
      predictionId: 'pred_2',
      canonicalMatchId: 'match_2',
      market: 'AH',
      selection: 'Liverpool -0.5',
      line: -0.5,
      predictedProbability: 0.68,
      odds: 1.90,
      closingOdds: 1.95, // CLV = -2.56%
      outcome: 'WIN',
      profitUnits: 0.90,
      settledAt: '2026-09-26T22:00:00Z',
      kickoffUtc: '2026-09-26T17:30:00Z',
      isHighConfidence: true,
    },
    {
      predictionId: 'pred_3',
      canonicalMatchId: 'match_3',
      market: 'OU',
      selection: 'Over 2.5',
      line: 2.5,
      predictedProbability: 0.66,
      odds: 1.80,
      closingOdds: 1.75,
      outcome: 'LOSS',
      profitUnits: -1.0,
      settledAt: '2026-09-26T22:00:00Z',
      kickoffUtc: '2026-09-26T19:00:00Z',
      isHighConfidence: true,
    },
    {
      predictionId: 'pred_4',
      canonicalMatchId: 'match_4',
      market: 'BTTS',
      selection: 'BTTS Yes',
      line: 0,
      predictedProbability: 0.60,
      odds: 1.80,
      closingOdds: 1.80,
      outcome: 'LOSS',
      profitUnits: -1.0,
      settledAt: '2026-09-26T22:00:00Z',
      kickoffUtc: '2026-09-26T20:00:00Z',
      isHighConfidence: false,
    },
  ];

  it('calculates Brier score accurately for binary outcomes', () => {
    const ahObs = sampleObservations.filter((o) => o.market === 'AH');
    const brier = ModelHealthService.calculateBrierScore(ahObs);
    expect(brier).toBe(0.0962);
  });

  it('calculates Log Loss accurately', () => {
    const ahObs = sampleObservations.filter((o) => o.market === 'AH');
    const logLoss = ModelHealthService.calculateLogLoss(ahObs);
    expect(logLoss).not.toBeNull();
    expect(logLoss!).toBeGreaterThan(0);
    expect(logLoss!).toBeLessThan(1.0);
  });

  it('evaluates market health metrics for Asian Handicap', () => {
    const ahMetrics = ModelHealthService.evaluateMarket('AH', sampleObservations);
    expect(ahMetrics.market).toBe('AH');
    expect(ahMetrics.sampleSize).toBe(2);
    expect(ahMetrics.winRatePct).toBe(100.0);
    expect(ahMetrics.yieldPct).toBe(87.5);
    expect(ahMetrics.avgOdds).toBe(1.88);
  });

  it('enforces BTTS benchmark comparison and research status', () => {
    const bttsMetrics = ModelHealthService.evaluateMarket('BTTS', sampleObservations);
    expect(bttsMetrics.market).toBe('BTTS');
    expect(bttsMetrics.status).toBe('RESEARCH_ONLY');
    expect(bttsMetrics.benchmarkComparison?.benchmarkBrier).toBe(0.2444);
    expect(bttsMetrics.benchmarkComparison?.benchmarkName).toContain('Pinnacle');
  });

  it('generates multi-window summary evaluating the >65% target win rate KPI', () => {
    const summary = ModelHealthService.generateWindowSummary(
      'DAILY',
      '2026-09-26',
      '2026-09-27',
      sampleObservations
    );

    expect(summary.window).toBe('DAILY');
    expect(summary.totalSettled).toBe(4);
    expect(summary.targetWinRatePct).toBe(65.0);
    expect(summary.overallWinRatePct).toBe(50.0);
    expect(summary.targetAchieved).toBe(false);
    expect(summary.diagnostics.some((d) => d.includes('KPI NOTICE'))).toBe(true);
    expect(summary.diagnostics.some((d) => d.includes('BTTS: Held in RESEARCH_ONLY'))).toBe(true);
  });
});
