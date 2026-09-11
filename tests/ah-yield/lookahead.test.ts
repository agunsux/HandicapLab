import { describe, it, expect } from 'vitest';
import {
  createSeasonFolds,
  runAhWalkForward,
} from '../../src/lib/research/ah-yield/ahWalkForward';
import type { AhBetObservation } from '../../src/lib/research/ah-yield/ahTypes';
import { makeObs } from './helpers';

function seasonObs(season: string, count: number, winPattern: (i: number) => boolean): AhBetObservation[] {
  const [startYear] = season.split('-');
  return Array.from({ length: count }, (_, i) =>
    makeObs({
      season,
      matchDate: `${Number(startYear) + 1}-0${(i % 8) + 1}-01`,
      side: 'home',
      marketLineHome: -0.5,
      homeScore: winPattern(i) ? 1 : 0,
      awayScore: winPattern(i) ? 0 : 1,
      odds: 1.95,
      snapshot: 'closing',
      provenance: 'pinnacle',
      canonicalMatchId: `${season}-match-${i}`,
    })
  );
}

describe('Walk-forward temporal integrity (spec §15, §26)', () => {
  it('creates season folds with growing train windows', () => {
    const obs = [
      ...seasonObs('2019-2020', 4, () => true),
      ...seasonObs('2020-2021', 4, () => false),
      ...seasonObs('2021-2022', 4, () => true),
      ...seasonObs('2022-2023', 4, () => false),
    ];
    const folds = createSeasonFolds(obs, 2);
    expect(folds).toHaveLength(2);
    expect(folds[0]).toEqual({ trainSeasons: ['2019-2020', '2020-2021'], testSeason: '2021-2022' });
    expect(folds[1].testSeason).toBe('2022-2023');
    expect(folds[1].trainSeasons).toEqual(['2019-2020', '2020-2021', '2021-2022']);
  });

  it('every fold has train max date strictly before test min date', () => {
    const obs = [
      ...seasonObs('2019-2020', 20, (i) => i % 2 === 0),
      ...seasonObs('2020-2021', 20, (i) => i % 2 === 0),
      ...seasonObs('2021-2022', 20, (i) => i % 3 !== 0),
      ...seasonObs('2022-2023', 20, (i) => i % 3 !== 0),
    ];
    const report = runAhWalkForward(obs, { snapshot: 'closing', provenance: 'pinnacle', minTrainSeasons: 2 });
    expect(report.folds.length).toBeGreaterThan(0);
    for (const fold of report.folds) {
      expect(fold.temporalIntegrityOk).toBe(true);
      expect(fold.trainMaxDate < fold.testMinDate).toBe(true);
      expect(fold.testBets).toBeGreaterThan(0);
    }
  });

  it('test-season outcomes cannot leak into model predictions (OOS decisions unchanged)', () => {
    const train1 = seasonObs('2019-2020', 40, (i) => i < 30);
    const train2 = seasonObs('2020-2021', 40, (i) => i < 30);
    const testTrue = seasonObs('2021-2022', 30, (i) => i < 10);
    const testFlipped = seasonObs('2021-2022', 30, (i) => i >= 10);

    const cfg = { snapshot: 'closing' as const, provenance: 'pinnacle' as const, minTrainSeasons: 2 };
    const a = runAhWalkForward([...train1, ...train2, ...testTrue], cfg);
    const b = runAhWalkForward([...train1, ...train2, ...testFlipped], cfg);

    const foldA = a.folds[0];
    const foldB = b.folds[0];
    // Selection depends only on train-fitted posterior + offer odds → identical.
    expect(foldB.positiveEvBets).toBe(foldA.positiveEvBets);
    expect(foldB.positiveEvStake).toBe(foldA.positiveEvStake);
    // Calibration predicted means depend only on train + offer odds → identical.
    for (let i = 0; i < foldA.calibration.length; i++) {
      expect(foldB.calibration[i].predictedMean).toBeCloseTo(foldA.calibration[i].predictedMean, 12);
    }
    // Realized outcomes differ (as they must).
    expect(foldB.brierScore).not.toBe(foldA.brierScore);
  });

  it('pushes are excluded from binary scoring instead of counted as wins/losses', () => {
    const decisive = (season: string, n: number): AhBetObservation[] =>
      Array.from({ length: n }, (_, i) =>
        makeObs({
          season,
          matchDate: `${Number(season.split('-')[0]) + 1}-0${(i % 8) + 1}-01`,
          side: 'home',
          marketLineHome: -1,
          homeScore: i % 2 === 0 ? 2 : 0,
          awayScore: 0,
          odds: 1.95,
          snapshot: 'closing',
          provenance: 'pinnacle',
          canonicalMatchId: `${season}-decisive-${i}`,
        })
      );
    const pushSeason = Array.from({ length: 10 }, (_, i) =>
      makeObs({
        season: '2021-2022',
        matchDate: `2022-0${(i % 8) + 1}-01`,
        side: 'home',
        marketLineHome: -1,
        homeScore: 2,
        awayScore: 1,
        odds: 1.95,
        snapshot: 'closing',
        provenance: 'pinnacle',
        canonicalMatchId: `push-${i}`,
      })
    );
    const report = runAhWalkForward(
      [...decisive('2019-2020', 30), ...decisive('2020-2021', 30), ...pushSeason],
      {
        snapshot: 'closing',
        provenance: 'pinnacle',
        minTrainSeasons: 2,
      }
    );
    const fold = report.folds[0];
    expect(fold.testBets).toBe(10);
    expect(fold.brierScore).toBeNull();
    expect(fold.logLoss).toBeNull();
    expect(fold.allBetsYieldPct).toBe(0);
  });

  it('seasons with no training data for a line are skipped, not silently scored', () => {
    const train = seasonObs('2019-2020', 10, () => true).map((o) => ({ ...o, marketLineHome: -0.5 }));
    const train2 = seasonObs('2020-2021', 10, () => true).map((o) => ({ ...o, marketLineHome: -0.5 }));
    const testOtherLine = seasonObs('2021-2022', 5, () => true).map((o) => ({ ...o, marketLineHome: 1.5 }));
    const report = runAhWalkForward([...train, ...train2, ...testOtherLine], {
      snapshot: 'closing',
      provenance: 'pinnacle',
      minTrainSeasons: 2,
    });
    expect(report.folds[0].testBets).toBe(0);
    expect(report.folds[0].skippedNoTrain).toBe(5);
  });
});
