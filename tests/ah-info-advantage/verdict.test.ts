import { describe, it, expect } from 'vitest';
import { determineFinalVerdict } from '../../src/lib/research/ah-info-advantage/infoReport';
import type { MetricSummaryStats } from '../../src/lib/research/ah-info-advantage/infoTypes';

function makeMockStats(overrides: Partial<MetricSummaryStats> = {}): MetricSummaryStats {
  return {
    bets: 1000,
    pushes: 50,
    brier: 0.2505,
    logLoss: 0.6945,
    ece: 0.035,
    hitRate: 49.5,
    allBetsRoi: -1.8,
    evPositiveBets: 400,
    evPositiveRoi: -0.5,
    evPositiveCi95: [-4.5, 3.5],
    evPositiveClv: 0.5,
    positiveFolds: 2,
    medianFoldRoi: -0.8,
    deltaBrierVsBaseline: 0.0005,
    deltaBrierCi95: [-0.001, 0.002],
    deltaBrierPValue: 0.5,
    deltaBrierZ: 0.6,
    ...overrides,
  };
}

describe('AH Info Advantage — Verdict Engine Tests', () => {
  it('returns C when model does not beat market baseline', () => {
    const stats = makeMockStats({ brier: 0.2510, evPositiveRoi: -1.5 });
    const earlyMkt = makeMockStats({ brier: 0.2498 });
    const earlyPlusFoot = makeMockStats({ brier: 0.2502, evPositiveRoi: -1.0 });

    const verdict = determineFinalVerdict({
      ablationStats: { M0: stats, M1: stats, M2: stats, M3: stats, M4: stats, M5: stats, M6: stats, M7: stats, F0: stats },
      earlyVsClosing: { earlyMarketStats: earlyMkt, earlyPlusFootballStats: earlyPlusFoot },
      clvDecomposition: {
        totalEarlyBets: 1000,
        betsWithClosingQuote: 1000,
        avgClv: -0.2,
        positiveClvPct: 48,
        realizedRoiAll: -2.0,
        realizedRoiPositiveClv: -0.5,
        realizedRoiNegativeClv: -3.5,
        clvToRoiPearsonCorr: 0.05,
        conclusion: 'Negative mean CLV',
      },
      incrementalTests: [],
    });

    expect(verdict.verdictCode).toBe('C');
    expect(verdict.verdictLabel).toBe('NO DEMONSTRATED INFORMATION ADVANTAGE');
  });

  it('returns B when directional improvement exists without full statistical significance', () => {
    const stats = makeMockStats({ brier: 0.2495, evPositiveRoi: 2.1, evPositiveCi95: [-2.0, 6.2] });
    const earlyMkt = makeMockStats({ brier: 0.2498 });
    const earlyPlusFoot = makeMockStats({ brier: 0.2492, evPositiveRoi: 2.1, evPositiveCi95: [-2.0, 6.2] });

    const verdict = determineFinalVerdict({
      ablationStats: { M0: stats, M1: stats, M2: stats, M3: stats, M4: stats, M5: stats, M6: stats, M7: stats, F0: stats },
      earlyVsClosing: { earlyMarketStats: earlyMkt, earlyPlusFootballStats: earlyPlusFoot },
      clvDecomposition: {
        totalEarlyBets: 1000,
        betsWithClosingQuote: 1000,
        avgClv: 1.2,
        positiveClvPct: 53,
        realizedRoiAll: 1.5,
        realizedRoiPositiveClv: 3.2,
        realizedRoiNegativeClv: -0.8,
        clvToRoiPearsonCorr: 0.12,
        conclusion: 'Positive mean CLV',
      },
      incrementalTests: [],
    });

    expect(verdict.verdictCode).toBe('B');
    expect(verdict.verdictLabel).toBe('PROMISING SIGNAL — INSUFFICIENT EVIDENCE');
  });

  it('never assigns A on positive historical ROI alone if lower 95% CI is <= 0', () => {
    // ROI is +15%, but CI lower bound is -1.0% -> Must be B, NOT A!
    const stats = makeMockStats({ brier: 0.2492, evPositiveRoi: 15.0, evPositiveCi95: [-1.0, 31.0] });
    const earlyMkt = makeMockStats({ brier: 0.2498 });
    const earlyPlusFoot = makeMockStats({ brier: 0.2492, evPositiveRoi: 15.0, evPositiveCi95: [-1.0, 31.0] });

    const verdict = determineFinalVerdict({
      ablationStats: { M0: stats, M1: stats, M2: stats, M3: stats, M4: stats, M5: stats, M6: stats, M7: stats, F0: stats },
      earlyVsClosing: { earlyMarketStats: earlyMkt, earlyPlusFootballStats: earlyPlusFoot },
      clvDecomposition: {
        totalEarlyBets: 1000,
        betsWithClosingQuote: 1000,
        avgClv: 2.5,
        positiveClvPct: 55,
        realizedRoiAll: 4.5,
        realizedRoiPositiveClv: 8.0,
        realizedRoiNegativeClv: 1.0,
        clvToRoiPearsonCorr: 0.2,
        conclusion: 'Positive mean CLV',
      },
      incrementalTests: [],
    });

    expect(verdict.verdictCode).toBe('B');
    expect(verdict.verdictCode).not.toBe('A');
  });

  it('returns D when decided bets are below threshold (< 500)', () => {
    const stats = makeMockStats({ bets: 300 });
    const earlyMkt = makeMockStats({ bets: 300 });
    const earlyPlusFoot = makeMockStats({ bets: 300 });

    const verdict = determineFinalVerdict({
      ablationStats: { M0: stats, M1: stats, M2: stats, M3: stats, M4: stats, M5: stats, M6: stats, M7: stats, F0: stats },
      earlyVsClosing: { earlyMarketStats: earlyMkt, earlyPlusFootballStats: earlyPlusFoot },
      clvDecomposition: {
        totalEarlyBets: 300,
        betsWithClosingQuote: 300,
        avgClv: 0,
        positiveClvPct: 50,
        realizedRoiAll: 0,
        realizedRoiPositiveClv: 0,
        realizedRoiNegativeClv: 0,
        clvToRoiPearsonCorr: 0,
        conclusion: 'Small sample',
      },
      incrementalTests: [],
    });

    expect(verdict.verdictCode).toBe('D');
    expect(verdict.verdictLabel).toBe('DATA INSUFFICIENT');
  });
});
