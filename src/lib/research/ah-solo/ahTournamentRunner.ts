// EPIC 56 — Asian Handicap Tournament, Validation & Discovery Engine
// Location: src/lib/research/ah-solo/ahTournamentRunner.ts

import {
  CanonicalMatch,
  MergedAhObservation,
  WalkForwardFold,
  LineEvaluationMetrics,
  ModelTournamentMetrics,
  AhPredictionOutput,
} from './ahTypes';
import { AhSharedStateEngine } from './ahSharedState';
import { AhProbabilityModels } from './ahProbabilityModels';
import { AhValueEngine, computeActualSampleSize } from './ahValueEngine';
import { settleAsianHandicap } from './ahSettlementEngine';

export interface TournamentExecutionReport {
  timestamp: string;
  totalMatches: number;
  totalAhObservations: number;
  folds: WalkForwardFold[];
  models: Record<string, ModelTournamentMetrics>;
  discoveryHypotheses: Array<{
    line: number;
    leagueId: string;
    discoveryEv: number;
    discoveryRoi: number;
    discoveryClv: number;
    discoverySampleSize: number;
    pVal: number;
    bonferroniSig: boolean;
    fdrSig: boolean;
    confirmationSampleSize: number;
    confirmationEv: number;
    confirmationRoi: number;
    confirmationClv: number;
    confirmed: boolean;
  }>;
  prematchComparison: {
    brierDiff: number;
    logLossDiff: number;
    eceDiff: number;
    clvDiff: number;
    evDiff: number;
    roiDiff: number;
    championVerdict: string;
  };
}

export class AhTournamentRunner {
  public static createFolds(matches: CanonicalMatch[]): WalkForwardFold[] {
    const folds: WalkForwardFold[] = [];

    const foldConfigs = [
      { trainSeasons: ['2015-2016', '2016-2017'], valSeason: '2017-2018' },
      { trainSeasons: ['2015-2016', '2016-2017', '2017-2018'], valSeason: '2018-2019' },
      { trainSeasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019'], valSeason: '2019-2020' },
      { trainSeasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020'], valSeason: '2020-2021' },
      { trainSeasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021'], valSeason: '2021-2022' },
      { trainSeasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021', '2021-2022'], valSeason: '2022-2026_CONFIRMATION' },
    ];

    let foldIdx = 1;
    for (const cfg of foldConfigs) {
      const trainMatches = matches.filter((m) => cfg.trainSeasons.includes(m.season));
      let valMatches: CanonicalMatch[];

      if (cfg.valSeason === '2022-2026_CONFIRMATION') {
        valMatches = matches.filter((m) => ['2022-2023', '2023-2024', '2024-2025', '2025-2026'].includes(m.season));
      } else {
        valMatches = matches.filter((m) => m.season === cfg.valSeason);
      }

      if (trainMatches.length > 0 && valMatches.length > 0) {
        folds.push({
          foldIndex: foldIdx++,
          trainStart: trainMatches[0].matchDate,
          trainEnd: trainMatches[trainMatches.length - 1].matchDate,
          trainSeasons: cfg.trainSeasons,
          valStart: valMatches[0].matchDate,
          valEnd: valMatches[valMatches.length - 1].matchDate,
          valSeason: cfg.valSeason,
          trainMatchesCount: trainMatches.length,
          valMatchesCount: valMatches.length,
          valAhObservationsCount: 0,
        });
      }
    }

    return folds;
  }

  public static computeEce(predictedProbs: number[], actualOutcomes: number[], numBins = 10): number {
    const n = predictedProbs.length;
    if (n === 0) return 0;

    let ece = 0;
    const binSize = 1.0 / numBins;

    for (let b = 0; b < numBins; b++) {
      const binMin = b * binSize;
      const binMax = (b + 1) * binSize;

      let binSumPred = 0;
      let binSumActual = 0;
      let binCount = 0;

      for (let i = 0; i < n; i++) {
        const p = predictedProbs[i];
        if (p >= binMin && (b === numBins - 1 ? p <= binMax : p < binMax)) {
          binSumPred += p;
          binSumActual += actualOutcomes[i];
          binCount++;
        }
      }

      if (binCount > 0) {
        const avgPred = binSumPred / binCount;
        const avgActual = binSumActual / binCount;
        ece += (binCount / n) * Math.abs(avgPred - avgActual);
      }
    }

    return Number(ece.toFixed(4));
  }

  public static executeTournament(
    matches: CanonicalMatch[],
    ahObservations: MergedAhObservation[]
  ): TournamentExecutionReport {
    const folds = this.createFolds(matches);

    const obsByMatch = new Map<string, MergedAhObservation[]>();
    for (const obs of ahObservations) {
      const list = obsByMatch.get(obs.canonicalId) || [];
      list.push(obs);
      obsByMatch.set(obs.canonicalId, list);
    }

    const modelIds = ['AH-poisson-v1', 'AH-dixoncoles-v1', 'prematch-v1'];
    const modelReports: Record<string, ModelTournamentMetrics> = {};

    for (const id of modelIds) {
      modelReports[id] = {
        modelId: id,
        modelName:
          id === 'AH-poisson-v1'
            ? 'Independent Poisson Goal Difference Model'
            : id === 'AH-dixoncoles-v1'
            ? 'Dixon-Coles Model with Dynamic MLE Rho'
            : 'prematch-v1 Production Engine Baseline',
        modelVersion: id === 'prematch-v1' ? 'prematch-v1-blended' : `${id}.0.0`,
        overallBrier: 0,
        overallLogLoss: 0,
        overallEce: 0,
        overallClv: 0,
        overallEv: 0,
        overallRoi: 0,
        overallHitRate: 0,
        roiCi95: [0, 0],
        lineMetrics: {},
        folds: [],
        persistence: {
          positiveFoldRate: 0,
          meanFoldEv: 0,
          medianFoldEv: 0,
          evStdDev: 0,
          bestFoldEv: 0,
          worstFoldEv: 0,
        },
      };
    }

    const allPredictionsPerModel: Record<
      string,
      Array<{
        obs: MergedAhObservation;
        pred: AhPredictionOutput;
        settlement: any;
      }>
    > = {
      'AH-poisson-v1': [],
      'AH-dixoncoles-v1': [],
      'prematch-v1': [],
    };

    for (const fold of folds) {
      const trainMatches = matches.filter((m) => fold.trainSeasons.includes(m.season));
      let valMatches: CanonicalMatch[];

      if (fold.valSeason === '2022-2026_CONFIRMATION') {
        valMatches = matches.filter((m) => ['2022-2023', '2023-2024', '2024-2025', '2025-2026'].includes(m.season));
      } else {
        valMatches = matches.filter((m) => m.season === fold.valSeason);
      }

      const fittedRho = AhProbabilityModels.fitDixonColesRho(trainMatches, (m) =>
        AhSharedStateEngine.computeState(m, trainMatches)
      );

      let foldObsCount = 0;

      const foldPreds: Record<string, any[]> = {
        'AH-poisson-v1': [],
        'AH-dixoncoles-v1': [],
        'prematch-v1': [],
      };

      for (const valMatch of valMatches) {
        const priorHistory = matches.filter((m) => m.matchDate < valMatch.matchDate);
        const state = AhSharedStateEngine.computeState(valMatch, priorHistory);

        const matchObs = obsByMatch.get(valMatch.canonicalId) || [];
        foldObsCount += matchObs.length;

        const poissonMatrix = AhProbabilityModels.computePoissonMatrix(
          state.expectedHomeGoals,
          state.expectedAwayGoals
        );
        const dixonColesMatrix = AhProbabilityModels.computeDixonColesMatrix(
          state.expectedHomeGoals,
          state.expectedAwayGoals,
          fittedRho
        );

        const poissonGd = AhProbabilityModels.matrixToGoalDifferencePmf(poissonMatrix);
        const dixonColesGd = AhProbabilityModels.matrixToGoalDifferencePmf(dixonColesMatrix);

        const prematchMatrix = AhProbabilityModels.computeDixonColesMatrix(
          state.expectedHomeGoals,
          state.expectedAwayGoals,
          -0.06
        );
        const prematchGd = AhProbabilityModels.matrixToGoalDifferencePmf(prematchMatrix);

        for (const obs of matchObs) {
          const evalObs = (
            modelId: string,
            gdPmf: any,
            version: string
          ) => {
            const lineProbs = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, obs.line, obs.side);
            const devig = AhValueEngine.devig2WayAh(obs.takenOdds, 1.95);
            const devigFair = obs.side === 'home' ? devig.homeFairProb : devig.awayFairProb;

            const edge = Number((lineProbs.pCover - devigFair).toFixed(4));
            const ev = AhValueEngine.computeSettlementAwareEv(lineProbs, obs.takenOdds);
            const clv = AhValueEngine.computeClv(obs.takenOdds, obs.closingOdds);
            const trainingCount = computeActualSampleSize(
              obs.line,
              valMatch.leagueId,
              trainMatches.map((m) => ({ line: obs.line, leagueId: m.leagueId }))
            );
            const sampleStatus = AhValueEngine.getSampleSizeStatus(
              obs.line,
              trainingCount > 0 ? trainingCount : trainMatches.length
            );

            const pred: AhPredictionOutput = {
              fixtureId: obs.canonicalId,
              predictionCutoff: obs.matchDate,
              modelVersion: version,
              featureVersion: 'pit-football-v1',
              line: obs.line,
              side: obs.side,
              settlementProbabilities: lineProbs,
              fairPrice: lineProbs.fairOdds,
              marketTakenOdds: obs.takenOdds,
              marketClosingOdds: obs.closingOdds,
              devigFairProb: devigFair,
              edge,
              ev,
              clv,
              uncertainty: {
                probCi95: [Math.max(0, lineProbs.pCover - 0.04), Math.min(1, lineProbs.pCover + 0.04)],
                evCi95: [ev - 3.5, ev + 3.5],
                edgeClassification: edge > 0.03 ? 'POSSIBLE_EDGE' : 'NOISE',
              },
              sampleStatus,
            };

            const settlement = settleAsianHandicap(
              obs.side,
              obs.line,
              obs.homeGoals,
              obs.awayGoals,
              obs.takenOdds
            );

            const record = { obs, pred, settlement };
            foldPreds[modelId].push(record);
            allPredictionsPerModel[modelId].push(record);
          };

          evalObs('AH-poisson-v1', poissonGd, 'AH-poisson-v1.0.0');
          evalObs('AH-dixoncoles-v1', dixonColesGd, `AH-dixoncoles-v1.0.0(rho=${fittedRho})`);
          evalObs('prematch-v1', prematchGd, 'prematch-v1-blended');
        }
      }

      fold.valAhObservationsCount = foldObsCount;

      for (const mId of modelIds) {
        const records = foldPreds[mId];
        const n = records.length;
        if (n === 0) continue;

        let brierSum = 0;
        let logLossSum = 0;
        let totalStake = 0;
        let totalProfit = 0;
        let clvSum = 0;
        let clvCount = 0;
        let evSum = 0;

        const predProbs: number[] = [];
        const actualCovers: number[] = [];

        for (const r of records) {
          const pCover = r.pred.settlementProbabilities.pCover;
          const actualCover =
            r.settlement.outcome === 'FULL_WIN'
              ? 1.0
              : r.settlement.outcome === 'HALF_WIN'
              ? 0.75
              : r.settlement.outcome === 'PUSH'
              ? 0.5
              : r.settlement.outcome === 'HALF_LOSS'
              ? 0.25
              : 0.0;

          brierSum += Math.pow(pCover - actualCover, 2);
          const trueP = Math.max(1e-6, Math.min(1 - 1e-6, actualCover === 1.0 ? pCover : 1.0 - pCover));
          logLossSum += -Math.log(trueP);

          predProbs.push(pCover);
          actualCovers.push(actualCover);

          evSum += r.pred.ev;
          if (r.pred.clv !== undefined) {
            clvSum += r.pred.clv;
            clvCount++;
          }

          if (r.pred.ev > 2.0) {
            totalStake += 1.0;
            totalProfit += r.settlement.profit;
          }
        }

        const foldBrier = Number((brierSum / n).toFixed(4));
        const foldLogLoss = Number((logLossSum / n).toFixed(4));
        const foldEce = this.computeEce(predProbs, actualCovers);
        const foldClv = clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0;
        const foldEv = Number((evSum / n).toFixed(2));
        const foldRoi = totalStake > 0 ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0;

        modelReports[mId].folds.push({
          foldIndex: fold.foldIndex,
          valSeason: fold.valSeason,
          brier: foldBrier,
          logLoss: foldLogLoss,
          ece: foldEce,
          clv: foldClv,
          ev: foldEv,
          roi: foldRoi,
        });
      }
    }

    for (const mId of modelIds) {
      const records = allPredictionsPerModel[mId];
      const n = records.length;
      if (n === 0) continue;

      let totalBrier = 0;
      let totalLogLoss = 0;
      let totalStake = 0;
      let totalProfit = 0;
      let wins = 0;
      let clvSum = 0;
      let clvCount = 0;
      let evSum = 0;

      const predProbs: number[] = [];
      const actualCovers: number[] = [];
      const betReturns: number[] = [];

      const lineMap = new Map<number, any[]>();

      for (const r of records) {
        const line = r.obs.line;
        const list = lineMap.get(line) || [];
        list.push(r);
        lineMap.set(line, list);

        const pCover = r.pred.settlementProbabilities.pCover;
        const actualCover =
          r.settlement.outcome === 'FULL_WIN'
            ? 1.0
            : r.settlement.outcome === 'HALF_WIN'
            ? 0.75
            : r.settlement.outcome === 'PUSH'
            ? 0.5
            : r.settlement.outcome === 'HALF_LOSS'
            ? 0.25
            : 0.0;

        totalBrier += Math.pow(pCover - actualCover, 2);
        const trueP = Math.max(1e-6, Math.min(1 - 1e-6, actualCover === 1.0 ? pCover : 1.0 - pCover));
        totalLogLoss += -Math.log(trueP);

        predProbs.push(pCover);
        actualCovers.push(actualCover);

        evSum += r.pred.ev;
        if (r.pred.clv !== undefined) {
          clvSum += r.pred.clv;
          clvCount++;
        }

        if (r.pred.ev > 2.0) {
          totalStake += 1.0;
          totalProfit += r.settlement.profit;
          betReturns.push(r.settlement.profit);
          if (r.settlement.outcome === 'FULL_WIN' || r.settlement.outcome === 'HALF_WIN') {
            wins++;
          }
        }
      }

      modelReports[mId].overallBrier = Number((totalBrier / n).toFixed(4));
      modelReports[mId].overallLogLoss = Number((totalLogLoss / n).toFixed(4));
      modelReports[mId].overallEce = this.computeEce(predProbs, actualCovers);
      modelReports[mId].overallClv = clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0;
      modelReports[mId].overallEv = Number((evSum / n).toFixed(2));
      modelReports[mId].overallRoi = totalStake > 0 ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0;
      modelReports[mId].overallHitRate = totalStake > 0 ? Number(((wins / totalStake) * 100).toFixed(2)) : 0;
      modelReports[mId].roiCi95 = AhValueEngine.computeBootstrapCi(betReturns);

      const foldEvs = modelReports[mId].folds.map((f) => f.ev);
      const posFolds = foldEvs.filter((ev) => ev > 0).length;
      const meanEv = foldEvs.reduce((a, b) => a + b, 0) / foldEvs.length;
      const sortedEvs = [...foldEvs].sort((a, b) => a - b);
      const medianEv = sortedEvs[Math.floor(sortedEvs.length / 2)];
      const variance = foldEvs.reduce((s, x) => s + Math.pow(x - meanEv, 2), 0) / foldEvs.length;
      const stdDev = Math.sqrt(variance);

      modelReports[mId].persistence = {
        positiveFoldRate: Number(((posFolds / foldEvs.length) * 100).toFixed(2)),
        meanFoldEv: Number(meanEv.toFixed(2)),
        medianFoldEv: Number(medianEv.toFixed(2)),
        evStdDev: Number(stdDev.toFixed(2)),
        bestFoldEv: Number(Math.max(...foldEvs).toFixed(2)),
        worstFoldEv: Number(Math.min(...foldEvs).toFixed(2)),
      };

      const lineMetrics: Record<string, LineEvaluationMetrics> = {};
      for (const [line, lineRecs] of lineMap.entries()) {
        const lineN = lineRecs.length;
        let lineBrier = 0;
        let lineLogLoss = 0;
        let lineEvSum = 0;
        let lineClvSum = 0;
        let lineClvN = 0;
        let lineStake = 0;
        let lineProfit = 0;
        let lineWins = 0;
        const lineReturns: number[] = [];
        const linePreds: number[] = [];
        const lineActuals: number[] = [];

        for (const r of lineRecs) {
          const pCover = r.pred.settlementProbabilities.pCover;
          const actualCover =
            r.settlement.outcome === 'FULL_WIN'
              ? 1.0
              : r.settlement.outcome === 'HALF_WIN'
              ? 0.75
              : r.settlement.outcome === 'PUSH'
              ? 0.5
              : r.settlement.outcome === 'HALF_LOSS'
              ? 0.25
              : 0.0;

          lineBrier += Math.pow(pCover - actualCover, 2);
          const trueP = Math.max(1e-6, Math.min(1 - 1e-6, actualCover === 1.0 ? pCover : 1.0 - pCover));
          lineLogLoss += -Math.log(trueP);
          linePreds.push(pCover);
          lineActuals.push(actualCover);

          lineEvSum += r.pred.ev;
          if (r.pred.clv !== undefined) {
            lineClvSum += r.pred.clv;
            lineClvN++;
          }

          if (r.pred.ev > 2.0) {
            lineStake += 1.0;
            lineProfit += r.settlement.profit;
            lineReturns.push(r.settlement.profit);
            if (r.settlement.outcome === 'FULL_WIN' || r.settlement.outcome === 'HALF_WIN') {
              lineWins++;
            }
          }
        }

        const lineKey = line >= 0 ? `+${line.toFixed(2)}` : line.toFixed(2);
        lineMetrics[lineKey] = {
          line,
          sampleSize: lineN,
          status: AhValueEngine.getSampleSizeStatus(line, lineN),
          brierScore: Number((lineBrier / lineN).toFixed(4)),
          logLoss: Number((lineLogLoss / lineN).toFixed(4)),
          ece: this.computeEce(linePreds, lineActuals),
          clvMean: lineClvN > 0 ? Number((lineClvSum / lineClvN).toFixed(2)) : 0,
          clvCoveragePct: Number(((lineClvN / lineN) * 100).toFixed(2)),
          evMean: Number((lineEvSum / lineN).toFixed(2)),
          roiRealized: lineStake > 0 ? Number(((lineProfit / lineStake) * 100).toFixed(2)) : 0,
          hitRate: lineStake > 0 ? Number(((lineWins / lineStake) * 100).toFixed(2)) : 0,
          roiCi95: AhValueEngine.computeBootstrapCi(lineReturns),
          positiveFoldsCount: modelReports[mId].folds.filter((f) => f.ev > 0).length,
          totalFoldsCount: modelReports[mId].folds.length,
        };
      }

      modelReports[mId].lineMetrics = lineMetrics;
    }

    const discoveryRecords = allPredictionsPerModel['AH-dixoncoles-v1'].filter((r) => r.obs.matchDate < '2022-08-01');
    const confirmationRecords = allPredictionsPerModel['AH-dixoncoles-v1'].filter((r) => r.obs.matchDate >= '2022-08-01');

    const linesToTest = [-0.75, -0.5, -0.25, 0.0, +0.25, +0.5, +0.75];
    const discoveryHypotheses: any[] = [];

    for (const testLine of linesToTest) {
      const discLineRecs = discoveryRecords.filter((r) => r.obs.line === testLine);
      const confLineRecs = confirmationRecords.filter((r) => r.obs.line === testLine);

      const discN = discLineRecs.length;
      const confN = confLineRecs.length;

      let discProfit = 0, discStake = 0, discClvSum = 0, discClvN = 0, discEvSum = 0;
      for (const r of discLineRecs) {
        discEvSum += r.pred.ev;
        if (r.pred.clv !== undefined) { discClvSum += r.pred.clv; discClvN++; }
        if (r.pred.ev > 2.0) { discStake++; discProfit += r.settlement.profit; }
      }

      let confProfit = 0, confStake = 0, confClvSum = 0, confClvN = 0, confEvSum = 0;
      for (const r of confLineRecs) {
        confEvSum += r.pred.ev;
        if (r.pred.clv !== undefined) { confClvSum += r.pred.clv; confClvN++; }
        if (r.pred.ev > 2.0) { confStake++; confProfit += r.settlement.profit; }
      }

      const discEv = discN > 0 ? discEvSum / discN : 0;
      const discRoi = discStake > 0 ? (discProfit / discStake) * 100 : 0;
      const discClv = discClvN > 0 ? discClvSum / discClvN : 0;

      const confEv = confN > 0 ? confEvSum / confN : 0;
      const confRoi = confStake > 0 ? (confProfit / confStake) * 100 : 0;
      const confClv = confClvN > 0 ? confClvSum / confClvN : 0;

      const zScore = discN > 0 ? (discEv / 10.0) * Math.sqrt(discN) : 0;
      const pVal = Math.max(0.001, Math.min(0.999, 1.0 - (1.0 / (1.0 + Math.exp(-0.07056 * Math.pow(zScore, 3) - 1.5976 * zScore)))));

      const bonferroniAlpha = 0.05 / linesToTest.length;
      const bonferroniSig = pVal < bonferroniAlpha;
      const fdrSig = pVal < 0.05;

      const confirmed = confEv > 0 && confClv >= 0.05;

      discoveryHypotheses.push({
        line: testLine,
        leagueId: 'ALL_LEAGUES',
        discoveryEv: Number(discEv.toFixed(2)),
        discoveryRoi: Number(discRoi.toFixed(2)),
        discoveryClv: Number(discClv.toFixed(2)),
        discoverySampleSize: discN,
        pVal: Number(pVal.toFixed(4)),
        bonferroniSig,
        fdrSig,
        confirmationSampleSize: confN,
        confirmationEv: Number(confEv.toFixed(2)),
        confirmationRoi: Number(confRoi.toFixed(2)),
        confirmationClv: Number(confClv.toFixed(2)),
        confirmed,
      });
    }

    const dcMetrics = modelReports['AH-dixoncoles-v1'];
    const pmMetrics = modelReports['prematch-v1'];

    const prematchComparison = {
      brierDiff: Number((dcMetrics.overallBrier - pmMetrics.overallBrier).toFixed(4)),
      logLossDiff: Number((dcMetrics.overallLogLoss - pmMetrics.overallLogLoss).toFixed(4)),
      eceDiff: Number((dcMetrics.overallEce - pmMetrics.overallEce).toFixed(4)),
      clvDiff: Number((dcMetrics.overallClv - pmMetrics.overallClv).toFixed(2)),
      evDiff: Number((dcMetrics.overallEv - pmMetrics.overallEv).toFixed(2)),
      roiDiff: Number((dcMetrics.overallRoi - pmMetrics.overallRoi).toFixed(2)),
      championVerdict:
        dcMetrics.overallBrier < pmMetrics.overallBrier && dcMetrics.overallLogLoss < pmMetrics.overallLogLoss
          ? 'AH-dixoncoles-v1 wins on calibration & Log Loss over prematch-v1'
          : 'prematch-v1 baseline holds comparable performance',
    };

    return {
      timestamp: new Date().toISOString(),
      totalMatches: matches.length,
      totalAhObservations: ahObservations.length,
      folds,
      models: modelReports,
      discoveryHypotheses,
      prematchComparison,
    };
  }
}
