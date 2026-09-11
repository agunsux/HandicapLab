import { describe, it, expect } from 'vitest';
import {
  buildEdgeValidationReport,
  decideVerdict,
  renderEdgeValidationMarkdown,
} from '../../src/lib/research/ah-edge/edgeReport';
import type {
  EdgeFoldResult,
  EdgeWalkForwardReport,
  EdgeWalkForwardRun,
  ModelOosSummary,
} from '../../src/lib/research/ah-edge/edgeWalkForward';
import { PINNACLE_CLOSING_COHORT } from '../../src/lib/research/ah-edge/edgeData';

function fold(index: number): EdgeFoldResult {
  return {
    foldIndex: index,
    testSeason: `202${index}-202${index + 1}`,
    trainSeasons: ['2019-2020'],
    trainMatches: 700,
    testMatches: 700,
    testSides: 1400,
    models: [],
    market: { bets: 1200, pushes: 200, brier: 0.25, logLoss: 0.7, ece: 0.05, fiveClassLogLoss: null },
  };
}

function summary(overrides: Partial<ModelOosSummary> = {}): ModelOosSummary {
  return {
    modelId: 'poisson_glm',
    label: 'Poisson GLM',
    folds: 3,
    bets: 3000,
    pushes: 500,
    brier: 0.25,
    logLoss: 0.7,
    ece: 0.05,
    fiveClassLogLoss: 1.5,
    allBetsRoi: -0.017,
    evPositive: {
      bets: 800,
      stake: 800,
      pnl: -8,
      roi: -0.01,
      ci95: [-0.05, 0.03],
      maxDrawdown: 40,
    },
    selectedThreshold: {
      bets: 800,
      stake: 800,
      pnl: -8,
      roi: -0.01,
      ci95: [-0.05, 0.03],
      maxDrawdown: 40,
      thresholdsUsed: { '0': 3 },
      foldRois: [
        { season: '2021-2022', roi: -0.02, bets: 200, threshold: 0 },
        { season: '2022-2023', roi: 0.01, bets: 200, threshold: 0 },
        { season: '2023-2024', roi: -0.03, bets: 200, threshold: 0 },
      ],
      positiveFolds: 1,
      medianFoldRoi: -0.02,
      worstFoldRoi: -0.03,
      bestFoldRoi: 0.01,
    },
    byThreshold: [],
    vsMarket: { meanSquaredErrorDiff: 0.001, se: 0.002, ci95: [-0.003, 0.005], z: 0.5 },
    ...overrides,
  };
}

function makeRun(opts: {
  oosBets?: number;
  folds?: number;
  marketBrier?: number;
  model?: Partial<ModelOosSummary>;
}): EdgeWalkForwardRun {
  const foldCount = opts.folds ?? 3;
  const report: EdgeWalkForwardReport = {
    config: {
      modelIds: ['poisson_glm'],
      modelConfig: { groups: ['market'] },
      minTrainSeasons: 2,
      thresholds: [0],
      minThresholdBets: 100,
      calibrationBuckets: 10,
    },
    folds: Array.from({ length: foldCount }, (_, i) => fold(i)),
    market: {
      bets: opts.oosBets ?? 3000,
      pushes: 500,
      brier: opts.marketBrier ?? 0.25,
      logLoss: 0.7,
      ece: 0.05,
      fiveClassLogLoss: null,
    },
    models: [summary(opts.model)],
  };
  return { report, predictionsByModel: {} };
}

describe('Pre-registered verdict rules', () => {
  it('D — DATA INSUFFICIENT when OOS bets < 500', () => {
    const v = decideVerdict(makeRun({ oosBets: 300 }));
    expect(v.code).toBe('D');
    expect(v.label).toBe('DATA INSUFFICIENT');
  });

  it('D — DATA INSUFFICIENT when folds < 3', () => {
    const v = decideVerdict(makeRun({ folds: 2 }));
    expect(v.code).toBe('D');
  });

  it('C — NO DEMONSTRATED EDGE when the model neither beats the market nor selects profitably', () => {
    const v = decideVerdict(
      makeRun({
        model: {
          brier: 0.26,
          vsMarket: { meanSquaredErrorDiff: 0.01, se: 0.002, ci95: [0.006, 0.014], z: 5 },
          evPositive: { bets: 800, stake: 800, pnl: -24, roi: -0.03, ci95: [-0.07, -0.01], maxDrawdown: 40 },
        },
      })
    );
    expect(v.code).toBe('C');
    expect(v.evidence.brierBetter).toBe(false);
    expect(v.evidence.selectionPositive).toBe(false);
  });

  it('B — PROMISING BUT INSUFFICIENT EVIDENCE when Brier is better but not significant', () => {
    const v = decideVerdict(
      makeRun({
        model: {
          brier: 0.245,
          vsMarket: { meanSquaredErrorDiff: -0.003, se: 0.002, ci95: [-0.007, 0.001], z: -1.5 },
          evPositive: { bets: 800, stake: 800, pnl: -8, roi: -0.01, ci95: [-0.05, 0.03], maxDrawdown: 40 },
        },
      })
    );
    expect(v.code).toBe('B');
    expect(v.evidence.brierBetter).toBe(true);
    expect(v.evidence.brierSignificant).toBe(false);
  });

  it('A — DEMONSTRATED OOS EDGE only when significance, positive selection and fold stability all hold', () => {
    const v = decideVerdict(
      makeRun({
        model: {
          brier: 0.24,
          vsMarket: { meanSquaredErrorDiff: -0.01, se: 0.002, ci95: [-0.014, -0.006], z: -5 },
          evPositive: { bets: 800, stake: 800, pnl: 32, roi: 0.04, ci95: [0.01, 0.07], maxDrawdown: 20 },
          selectedThreshold: {
            bets: 800,
            stake: 800,
            pnl: 32,
            roi: 0.04,
            ci95: [0.01, 0.07],
            maxDrawdown: 20,
            thresholdsUsed: { '0.02': 2, '0': 1 },
            foldRois: [
              { season: '2021-2022', roi: 0.05, bets: 200, threshold: 0.02 },
              { season: '2022-2023', roi: 0.03, bets: 200, threshold: 0.02 },
              { season: '2023-2024', roi: -0.01, bets: 200, threshold: 0 },
            ],
            positiveFolds: 2,
            medianFoldRoi: 0.03,
            worstFoldRoi: -0.01,
            bestFoldRoi: 0.05,
          },
        },
      })
    );
    expect(v.code).toBe('A');
    expect(v.evidence.foldStable).toBe(true);
  });

  it('A is never granted on Brier alone (selection must be positive and significant)', () => {
    const v = decideVerdict(
      makeRun({
        model: {
          brier: 0.24,
          vsMarket: { meanSquaredErrorDiff: -0.01, se: 0.002, ci95: [-0.014, -0.006], z: -5 },
          evPositive: { bets: 800, stake: 800, pnl: -8, roi: -0.01, ci95: [-0.05, 0.03], maxDrawdown: 40 },
          selectedThreshold: null,
        },
      })
    );
    expect(v.code).toBe('B');
  });
});

describe('Report builder smoke test', () => {
  it('builds a complete JSON report and markdown with the verdict', () => {
    const run = makeRun({
      model: {
        brier: 0.245,
        vsMarket: { meanSquaredErrorDiff: -0.003, se: 0.002, ci95: [-0.007, 0.001], z: -1.5 },
      },
    });
    const report = buildEdgeValidationReport({
      generatedAt: '2026-01-01T00:00:00.000Z',
      primaryCohortId: PINNACLE_CLOSING_COHORT.id,
      cohorts: [
        {
          config: PINNACLE_CLOSING_COHORT,
          coverage: {
            canonicalMatches: 8898,
            eligibleMatches: 3040,
            withMlClosing: 3040,
            withMlOpening: 3039,
            withOuClosing: 3040,
            withAhOpening: 3039,
            seasons: ['2019-2020', '2025-2026'],
            leagues: ['ENG-PL'],
          },
          missingness: {
            totalMatches: 3040,
            eloFallbackHome: 0,
            eloFallbackAway: 0,
            formFallbackHome: 0,
            formFallbackAway: 0,
            leagueFallback: 0,
            restFallback: 0,
          },
          run,
          lineBreakdown: [],
          favoriteBreakdown: [],
          leagueBreakdown: [],
          thresholdSweep: [],
        },
      ],
      ablation: [],
      leagueGeneralization: [],
      researchLog: [],
    });
    expect(report.verdict.code).toBe('B');
    expect(report.featureInventory.length).toBeGreaterThan(5);
    const md = renderEdgeValidationMarkdown(report);
    expect(md).toContain('# AH PROBABILITY & EDGE VALIDATION REPORT');
    expect(md).toContain('B. PROMISING BUT INSUFFICIENT EVIDENCE');
    expect(md).toContain('FEATURE LEAKAGE AUDIT');
  });
});
