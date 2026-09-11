// AH YIELD ENGINE — Walk-forward validation (season folds).
//
// Temporal integrity: for every fold, the posterior used to price the test
// season is fitted ONLY on observations with strictly earlier match dates.
// Features (probabilities) never see the test season. Odds are pre-match
// market quotes from the frozen dataset. Pushes are excluded from binary
// scoring, never silently counted as wins or losses.

import type { AhBetObservation, AhProvenance, AhSnapshot } from './ahTypes';
import { assessAhBet } from './ahFairOdds';
import { fitAhPosterior, fitBinaryPositiveReturnPosterior } from './ahProbability';

export interface AhWalkForwardConfig {
  snapshot: AhSnapshot;
  provenance: AhProvenance;
  minTrainSeasons?: number;
  evThreshold?: number;
  calibrationBuckets?: number;
}

export interface AhCalibrationBucket {
  lower: number;
  upper: number;
  count: number;
  predictedMean: number;
  observedFrequency: number;
}

export interface AhWalkForwardFold {
  foldIndex: number;
  trainSeasons: string[];
  testSeason: string;
  trainBets: number;
  testBets: number;
  skippedNoTrain: number;
  brierScore: number | null;
  logLoss: number | null;
  ece: number | null;
  calibration: AhCalibrationBucket[];
  allBetsYieldPct: number | null;
  allBetsPnl: number;
  allBetsStake: number;
  positiveEvBets: number;
  positiveEvStake: number;
  positiveEvPnl: number;
  positiveEvYieldPct: number | null;
  temporalIntegrityOk: boolean;
  trainMaxDate: string;
  testMinDate: string;
}

export interface AhWalkForwardReport {
  config: Required<AhWalkForwardConfig>;
  folds: AhWalkForwardFold[];
  aggregate: {
    testBets: number;
    allBetsPnl: number;
    allBetsStake: number;
    allBetsYieldPct: number | null;
    positiveEvBets: number;
    positiveEvStake: number;
    positiveEvPnl: number;
    positiveEvYieldPct: number | null;
    meanBrier: number | null;
    meanLogLoss: number | null;
    meanEce: number | null;
    foldsWithPositiveValue: number;
    foldsCount: number;
  };
}

function clip(p: number, lo = 1e-9, hi = 1 - 1e-9): number {
  return Math.min(hi, Math.max(lo, p));
}

export function createSeasonFolds(observations: AhBetObservation[], minTrainSeasons: number): Array<{
  trainSeasons: string[];
  testSeason: string;
}> {
  const seasons = Array.from(new Set(observations.map((o) => o.season))).sort();
  const folds: Array<{ trainSeasons: string[]; testSeason: string }> = [];
  for (let i = minTrainSeasons; i < seasons.length; i++) {
    folds.push({ trainSeasons: seasons.slice(0, i), testSeason: seasons[i] });
  }
  return folds;
}

export function runAhWalkForward(
  observations: AhBetObservation[],
  config: AhWalkForwardConfig
): AhWalkForwardReport {
  const fullConfig: Required<AhWalkForwardConfig> = {
    snapshot: config.snapshot,
    provenance: config.provenance,
    minTrainSeasons: config.minTrainSeasons ?? 2,
    evThreshold: config.evThreshold ?? 0,
    calibrationBuckets: config.calibrationBuckets ?? 10,
  };

  const cohort = observations.filter(
    (o) => o.snapshot === fullConfig.snapshot && o.provenance === fullConfig.provenance
  );

  const folds = createSeasonFolds(cohort, fullConfig.minTrainSeasons);
  const results: AhWalkForwardFold[] = [];

  for (let foldIndex = 0; foldIndex < folds.length; foldIndex++) {
    const { trainSeasons, testSeason } = folds[foldIndex];
    const train = cohort.filter((o) => trainSeasons.includes(o.season));
    const test = cohort.filter((o) => o.season === testSeason);

    const trainMaxDate = train.reduce((max, o) => (o.matchDate > max ? o.matchDate : max), '');
    const testMinDate = test.reduce((min, o) => (o.matchDate < min || min === '' ? o.matchDate : min), '');
    const temporalIntegrityOk = train.length === 0 || trainMaxDate < testMinDate;

    // Fit posteriors per (line, side) on train only — once per group.
    const trainGroups = new Map<string, AhBetObservation[]>();
    for (const o of train) {
      const key = `${o.marketLineHome}|${o.side}`;
      const list = trainGroups.get(key);
      if (list) list.push(o);
      else trainGroups.set(key, [o]);
    }
    const posteriorsByKey = new Map<
      string,
      { posterior: ReturnType<typeof fitAhPosterior>; binary: ReturnType<typeof fitBinaryPositiveReturnPosterior> }
    >();
    for (const [key, group] of trainGroups) {
      posteriorsByKey.set(key, {
        posterior: fitAhPosterior(group),
        binary: fitBinaryPositiveReturnPosterior(group),
      });
    }

    const squared: number[] = [];
    const losses: number[] = [];
    const bucketCounts: number[] = [];
    const bucketPredicted: number[] = [];
    const bucketObserved: number[] = [];
    const B = fullConfig.calibrationBuckets;
    for (let i = 0; i < B; i++) {
      bucketCounts.push(0);
      bucketPredicted.push(0);
      bucketObserved.push(0);
    }

    let testBets = 0;
    let skippedNoTrain = 0;
    let allBetsPnl = 0;
    let allBetsStake = 0;
    let positiveEvBets = 0;
    let positiveEvStake = 0;
    let positiveEvPnl = 0;

    for (const obs of test) {
      if (obs.settlement === 'VOID') continue;
      const key = `${obs.marketLineHome}|${obs.side}`;
      const fitted = posteriorsByKey.get(key);
      if (!fitted) {
        skippedNoTrain += 1;
        continue;
      }
      testBets += 1;
      allBetsPnl += obs.pnl;
      allBetsStake += obs.stake;

      const { posterior, binary } = fitted;
      const y = obs.settlement === 'FULL_WIN' || obs.settlement === 'HALF_WIN' ? 1 : 0;
      const p = clip(binary.probability);

      if (obs.settlement !== 'PUSH') {
        squared.push((p - y) ** 2);
        losses.push(-(y * Math.log(p) + (1 - y) * Math.log(1 - p)));
        const bucket = Math.min(B - 1, Math.floor(p * B));
        bucketCounts[bucket] += 1;
        bucketPredicted[bucket] += p;
        bucketObserved[bucket] += y;
      }

      const assessment = assessAhBet(posterior, obs.odds, obs.oppositeOdds);
      if (assessment.modelEv > fullConfig.evThreshold) {
        positiveEvBets += 1;
        positiveEvStake += obs.stake;
        positiveEvPnl += obs.pnl;
      }
    }

    const calibration: AhCalibrationBucket[] = [];
    let ece = 0;
    for (let i = 0; i < B; i++) {
      const lower = i / B;
      const upper = (i + 1) / B;
      if (bucketCounts[i] === 0) {
        calibration.push({ lower, upper, count: 0, predictedMean: 0, observedFrequency: 0 });
        continue;
      }
      const predictedMean = bucketPredicted[i] / bucketCounts[i];
      const observedFrequency = bucketObserved[i] / bucketCounts[i];
      ece += (bucketCounts[i] / Math.max(1, squared.length)) * Math.abs(observedFrequency - predictedMean);
      calibration.push({ lower, upper, count: bucketCounts[i], predictedMean, observedFrequency });
    }

    results.push({
      foldIndex,
      trainSeasons,
      testSeason,
      trainBets: train.filter((o) => o.settlement !== 'VOID').length,
      testBets,
      skippedNoTrain,
      brierScore: squared.length > 0 ? squared.reduce((s, v) => s + v, 0) / squared.length : null,
      logLoss: losses.length > 0 ? losses.reduce((s, v) => s + v, 0) / losses.length : null,
      ece: squared.length > 0 ? ece : null,
      calibration,
      allBetsYieldPct: allBetsStake > 0 ? (allBetsPnl / allBetsStake) * 100 : null,
      allBetsPnl,
      allBetsStake,
      positiveEvBets,
      positiveEvStake,
      positiveEvPnl,
      positiveEvYieldPct: positiveEvStake > 0 ? (positiveEvPnl / positiveEvStake) * 100 : null,
      temporalIntegrityOk,
      trainMaxDate,
      testMinDate,
    });
  }

  const scored = results.filter((f) => f.brierScore !== null);
  const totalPositiveEvStake = results.reduce((s, f) => s + f.positiveEvStake, 0);
  const totalPositiveEvPnl = results.reduce((s, f) => s + f.positiveEvPnl, 0);
  const totalAllStake = results.reduce((s, f) => s + f.allBetsStake, 0);
  const totalAllPnl = results.reduce((s, f) => s + f.allBetsPnl, 0);

  return {
    config: fullConfig,
    folds: results,
    aggregate: {
      testBets: results.reduce((s, f) => s + f.testBets, 0),
      allBetsPnl: totalAllPnl,
      allBetsStake: totalAllStake,
      allBetsYieldPct: totalAllStake > 0 ? (totalAllPnl / totalAllStake) * 100 : null,
      positiveEvBets: results.reduce((s, f) => s + f.positiveEvBets, 0),
      positiveEvStake: totalPositiveEvStake,
      positiveEvPnl: totalPositiveEvPnl,
      positiveEvYieldPct: totalPositiveEvStake > 0 ? (totalPositiveEvPnl / totalPositiveEvStake) * 100 : null,
      meanBrier: scored.length > 0 ? scored.reduce((s, f) => s + (f.brierScore as number), 0) / scored.length : null,
      meanLogLoss: scored.length > 0 ? scored.reduce((s, f) => s + (f.logLoss as number), 0) / scored.length : null,
      meanEce: scored.length > 0 ? scored.reduce((s, f) => s + (f.ece as number), 0) / scored.length : null,
      foldsWithPositiveValue: results.filter((f) => (f.positiveEvYieldPct ?? 0) > 0).length,
      foldsCount: results.length,
    },
  };
}
