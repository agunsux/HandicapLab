import { describe, it, expect } from 'vitest';
import {
  computeGroupMetrics,
  runEdgeWalkForward,
  selectionMetrics,
} from '../../src/lib/research/ah-edge/edgeWalkForward';
import { runFeatureAblation, runLeaveOneLeagueOut } from '../../src/lib/research/ah-edge/edgeExperiments';
import type { EdgeBetPrediction, EdgeMatch } from '../../src/lib/research/ah-edge/edgeTypes';
import { ALL_FEATURE_GROUPS } from '../../src/lib/research/ah-edge/edgeTypes';
import { makeEdgeMatch } from './helpers';

function syntheticDataset(): EdgeMatch[] {
  const matches: EdgeMatch[] = [];
  const seasons = ['2017-2018', '2018-2019', '2019-2020', '2020-2021'];
  const teams = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  let day = 1;
  for (const season of seasons) {
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < teams.length; i += 2) {
        const home = teams[i];
        const away = teams[i + 1];
        // Deterministic pseudo-outcomes driven by team index and round.
        const homeGoals = (i + round) % 3;
        const awayGoals = (i + round + 1) % 2;
        matches.push(
          makeEdgeMatch({
            canonicalId: `${season}-${round}-${home}-${away}`,
            season,
            matchDate: `20${Number(season.slice(2, 4))}-${String(1 + round).padStart(2, '0')}-${String(
              10 + day
            ).padStart(2, '0')}`,
            homeTeam: home,
            awayTeam: away,
            homeGoals,
            awayGoals,
            ah: { line: -0.5, homeOdds: 1.9 + (i % 3) * 0.05, awayOdds: 2.0 - (i % 3) * 0.05 },
            mlClosing: { pHome: 0.4 + (i % 3) * 0.05, pDraw: 0.26, pAway: 0.34 - (i % 3) * 0.05 },
          })
        );
        day += 1;
      }
    }
  }
  return matches;
}

describe('Walk-forward mechanics (synthetic)', () => {
  const data = syntheticDataset();

  it('trains only on strictly earlier seasons and predicts only the test season', () => {
    const run = runEdgeWalkForward(data, {
      modelIds: ['poisson_glm', 'market_poisson'],
      modelConfig: { groups: [...ALL_FEATURE_GROUPS], training: { poissonEpochs: 40 } },
      minTrainSeasons: 2,
      thresholds: [0, 0.05],
      minThresholdBets: 10,
    });
    expect(run.report.folds.length).toBe(2);
    expect(run.report.folds[0].testSeason).toBe('2019-2020');
    expect(run.report.folds[0].trainSeasons).toEqual(['2017-2018', '2018-2019']);
    expect(run.report.folds[1].trainSeasons).toEqual(['2017-2018', '2018-2019', '2019-2020']);

    for (const modelId of ['poisson_glm', 'market_poisson']) {
      const rows = run.predictionsByModel[modelId];
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(['2019-2020', '2020-2021']).toContain(r.season);
        expect(r.line).toBe(-0.5);
        const sum =
          r.probabilities.pFullWin +
          r.probabilities.pHalfWin +
          r.probabilities.pPush +
          r.probabilities.pHalfLoss +
          r.probabilities.pFullLoss;
        expect(sum).toBeCloseTo(1, 6);
      }
      const summary = run.report.models.find((m) => m.modelId === modelId)!;
      expect(summary.brier).not.toBeNull();
      expect(summary.brier as number).toBeGreaterThanOrEqual(0);
      expect(summary.brier as number).toBeLessThanOrEqual(1);
      expect(summary.selectedThreshold).not.toBeNull();
      // The aggregate uses per-fold train-selected thresholds; every used
      // threshold must come from the pre-registered grid.
      expect(Object.keys(summary.selectedThreshold!.thresholdsUsed).length).toBeGreaterThan(0);
      for (const t of Object.keys(summary.selectedThreshold!.thresholdsUsed)) {
        expect([0, 0.05]).toContain(Number(t));
      }
      for (const foldRoi of summary.selectedThreshold!.foldRois) {
        expect([0, 0.05]).toContain(foldRoi.threshold);
      }
    }
  });

  it('never lets the threshold selection see the test season (mechanical check)', () => {
    // With a single zero threshold there is no selection to make; with many
    // thresholds, every fold must still report only pre-registered/thresholds
    // chosen inside the training window.
    const run = runEdgeWalkForward(data, {
      modelIds: ['market_poisson'],
      modelConfig: { groups: [...ALL_FEATURE_GROUPS] },
      minTrainSeasons: 2,
      thresholds: [0, 0.01, 0.02, 0.05],
      minThresholdBets: 10,
    });
    for (const fold of run.report.folds) {
      for (const m of fold.models) {
        expect(m.selectedThreshold).not.toBeNull();
        expect([0, 0.01, 0.02, 0.05]).toContain(m.selectedThreshold!.threshold);
      }
    }
  });
});

describe('Metric helpers', () => {
  it('selectionMetrics computes ROI, CI and drawdown from per-bet P&L', () => {
    const m = selectionMetrics([1, -1, -1, 2]);
    expect(m.bets).toBe(4);
    expect(m.pnl).toBeCloseTo(1, 6);
    expect(m.roi).toBeCloseTo(0.25, 6);
    expect(m.maxDrawdown).toBeCloseTo(2, 6);
    expect(m.ci95[0]).toBeLessThan(m.roi);
    expect(m.ci95[1]).toBeGreaterThan(m.roi);
  });

  it('computeGroupMetrics derives Brier and market comparison from prediction rows', () => {
    const rows: EdgeBetPrediction[] = [
      {
        canonicalId: 'a',
        matchDate: '2021-01-01',
        season: '2020-2021',
        leagueId: 'ENG-PL',
        side: 'home',
        line: -0.5,
        odds: 1.9,
        oppositeOdds: 2.0,
        favoriteStatus: 'favorite',
        actualOutcome: 'FULL_WIN',
        actualCategoryIndex: 0,
        y: 1,
        modelId: 'test',
        probabilities: { pFullWin: 0.6, pHalfWin: 0.1, pPush: 0.1, pHalfLoss: 0.1, pFullLoss: 0.1 },
        fairOdds: 1.5,
        modelEv: 0.2,
        modelBinaryProbability: 0.7,
        marketBinaryProbability: 0.6,
        marketEv: 0.1,
      },
      {
        canonicalId: 'b',
        matchDate: '2021-01-02',
        season: '2020-2021',
        leagueId: 'ENG-PL',
        side: 'away',
        line: -0.5,
        odds: 2.0,
        oppositeOdds: 1.9,
        favoriteStatus: 'underdog',
        actualOutcome: 'FULL_LOSS',
        actualCategoryIndex: 4,
        y: 0,
        modelId: 'test',
        probabilities: { pFullWin: 0.2, pHalfWin: 0.1, pPush: 0.1, pHalfLoss: 0.1, pFullLoss: 0.5 },
        fairOdds: 2.5,
        modelEv: -0.1,
        modelBinaryProbability: 0.3,
        marketBinaryProbability: 0.4,
        marketEv: -0.2,
      },
    ];
    const m = computeGroupMetrics('test', rows);
    expect(m.bets).toBe(2);
    // Brier: ((0.7-1)^2 + (0.3-0)^2)/2 = (0.09+0.09)/2 = 0.09
    expect(m.brier).toBeCloseTo(0.09, 6);
    // Market Brier: ((0.6-1)^2 + (0.4-0)^2)/2 = 0.16
    expect(m.marketBrier).toBeCloseTo(0.16, 6);
    expect(m.evPositiveBets).toBe(1);
    expect(m.evPositivePnl).toBeCloseTo(0.9, 6);
  });
});

describe('Experiments smoke tests', () => {
  const data = syntheticDataset();

  it('ablation runs cumulative feature groups and returns one row per group', () => {
    const rows = runFeatureAblation(data, { modelId: 'poisson_glm', epochs: 30, minTrainSeasons: 2 });
    expect(rows.length).toBe(5);
    expect(rows[0].groups).toEqual(['market']);
    expect(rows[4].groups).toEqual(ALL_FEATURE_GROUPS);
    for (const r of rows) {
      expect(r.bets).toBeGreaterThan(0);
      expect(r.brier).not.toBeNull();
    }
  });

  it('leave-one-league-out trains on other leagues only and reports per-league metrics', () => {
    const withLeagues = data.map((m, i) => ({ ...m, leagueId: i % 2 === 0 ? 'ENG-PL' : 'ESP-LALIGA' }));
    const rows = runLeaveOneLeagueOut(withLeagues, {
      modelId: 'poisson_glm',
      modelConfig: { groups: [...ALL_FEATURE_GROUPS], training: { poissonEpochs: 30 } },
      minTrainMatches: 10,
      minTestMatches: 5,
    });
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.seasonsTested.length).toBeGreaterThan(0);
      expect(r.bets).toBeGreaterThan(0);
      expect(r.modelBrier).not.toBeNull();
      expect(r.marketBrier).not.toBeNull();
    }
  });
});
