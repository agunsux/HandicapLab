// EPIC 56 — Item 1 (Deduplication) & Item 2 (Shrinkage Grid) Targeted Investigation
// Location: src/scripts/audit-item1-item2.ts

import { AhDataLoader } from '../lib/research/ah-solo/ahDataLoader';
import { AhTournamentRunner } from '../lib/research/ah-solo/ahTournamentRunner';
import { AhValueEngine } from '../lib/research/ah-solo/ahValueEngine';
import { AhSharedStateEngine } from '../lib/research/ah-solo/ahSharedState';
import { AhProbabilityModels } from '../lib/research/ah-solo/ahProbabilityModels';
import { settleAsianHandicap } from '../lib/research/ah-solo/ahSettlementEngine';

async function runInvestigation() {
  console.log('================================================================');
  console.log('EPIC 56 — TARGETED AUDIT: ITEM 1 (DEDUPLICATION) & ITEM 2 (SHRINKAGE)');
  console.log('================================================================\n');

  const { matches, inventory, mergedAhObservations } = AhDataLoader.computeDataInventory();
  console.log(`Raw Merged AH Observations: ${mergedAhObservations.length}`);

  // Bookmaker Hierarchy priority: Pinnacle = 1, Bet365 = 2, Betbrain = 3, other = 4
  function getBookmakerRank(bk: string): number {
    const b = bk.toLowerCase();
    if (b.includes('pinnacle')) return 1;
    if (b.includes('bet365')) return 2;
    if (b.includes('betbrain')) return 3;
    return 4;
  }

  // Deduplicate mergedAhObservations by (canonicalId + line + side) keeping highest priority bookmaker
  const dedupMap = new Map<string, typeof mergedAhObservations[0]>();

  for (const obs of mergedAhObservations) {
    const key = `${obs.canonicalId}|${obs.line.toFixed(2)}|${obs.side}`;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, obs);
    } else {
      const existingRank = getBookmakerRank(existing.bookmaker);
      const newRank = getBookmakerRank(obs.bookmaker);
      if (newRank < existingRank) {
        dedupMap.set(key, obs);
      }
    }
  }

  const dedupedAhObservations = Array.from(dedupMap.values()).sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  console.log(`Deduplicated Fixture-Level AH Observations: ${dedupedAhObservations.length}`);

  // -------------------------------------------------------------
  // ITEM 1: Raw Row-Level vs Deduplicated Fixture-Level Comparison
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log('ITEM 1: ROW-LEVEL VS FIXTURE-LEVEL COMPARISON');
  console.log('=============================================================');

  const folds = AhTournamentRunner.createFolds(matches);

  function evaluatePopulation(observations: typeof mergedAhObservations, label: string) {
    const obsByMatch = new Map<string, typeof observations>();
    for (const obs of observations) {
      const list = obsByMatch.get(obs.canonicalId) || [];
      list.push(obs);
      obsByMatch.set(obs.canonicalId, list);
    }

    let totalObsEvaluated = 0;
    let evGt2Count = 0;
    let evGt2Profit = 0;
    let evGt2EvSum = 0;
    const betReturns: number[] = [];
    const clvValues: number[] = [];

    for (const fold of folds) {
      const trainMatches = matches.filter((m) => fold.trainSeasons.includes(m.season));
      let valMatches: any[];
      if (fold.valSeason === '2022-2026_CONFIRMATION') {
        valMatches = matches.filter((m) => ['2022-2023', '2023-2024', '2024-2025', '2025-2026'].includes(m.season));
      } else {
        valMatches = matches.filter((m) => m.season === fold.valSeason);
      }

      const fittedRho = AhProbabilityModels.fitDixonColesRho(trainMatches, (m) =>
        AhSharedStateEngine.computeState(m, trainMatches)
      );

      for (const valMatch of valMatches) {
        const priorHistory = matches.filter((m) => m.matchDate < valMatch.matchDate);
        const state = AhSharedStateEngine.computeState(valMatch, priorHistory);
        const dcMatrix = AhProbabilityModels.computeDixonColesMatrix(
          state.expectedHomeGoals,
          state.expectedAwayGoals,
          fittedRho
        );
        const dcGd = AhProbabilityModels.matrixToGoalDifferencePmf(dcMatrix);

        const matchObs = obsByMatch.get(valMatch.canonicalId) || [];
        for (const obs of matchObs) {
          totalObsEvaluated++;
          const lineProbs = AhProbabilityModels.deriveAhSettlementProbabilities(dcGd, obs.line, obs.side);
          const ev = AhValueEngine.computeSettlementAwareEv(lineProbs, obs.takenOdds);
          const clv = AhValueEngine.computeClv(obs.takenOdds, obs.closingOdds);
          if (clv !== undefined) clvValues.push(clv);

          const settlement = settleAsianHandicap(
            obs.side,
            obs.line,
            obs.homeGoals,
            obs.awayGoals,
            obs.takenOdds
          );

          if (ev > 2.0) {
            evGt2Count++;
            evGt2Profit += settlement.profit;
            evGt2EvSum += ev;
            betReturns.push(settlement.profit);
          }
        }
      }
    }

    const roi = evGt2Count > 0 ? (evGt2Profit / evGt2Count) * 100 : 0;
    const meanEv = evGt2Count > 0 ? evGt2EvSum / evGt2Count : 0;
    const meanReturn = evGt2Count > 0 ? evGt2Profit / evGt2Count : 0;
    const variance = betReturns.length > 1
      ? betReturns.reduce((s, x) => s + Math.pow(x - meanReturn, 2), 0) / (betReturns.length - 1)
      : 0;
    const se = Math.sqrt(variance / betReturns.length);
    const analyticalCi: [number, number] = [
      Number(((meanReturn - 1.96 * se) * 100).toFixed(2)),
      Number(((meanReturn + 1.96 * se) * 100).toFixed(2)),
    ];
    const bootstrapCi = AhValueEngine.computeBootstrapCi(betReturns, 2000);

    const clvMean = clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : 0;
    const clvVar = clvValues.length > 1
      ? clvValues.reduce((s, x) => s + Math.pow(x - clvMean, 2), 0) / (clvValues.length - 1)
      : 0;
    const clvSe = Math.sqrt(clvVar / clvValues.length);
    const clvZ = clvSe > 0 ? clvMean / clvSe : 0;

    return {
      label,
      totalObsEvaluated,
      evGt2Count,
      meanEv: Number(meanEv.toFixed(2)),
      totalProfit: Number(evGt2Profit.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      variance: Number(variance.toFixed(4)),
      sePercent: Number((se * 100).toFixed(2)),
      analyticalCi,
      bootstrapCi,
      clvN: clvValues.length,
      clvMean: Number(clvMean.toFixed(4)),
      clvSe: Number(clvSe.toFixed(4)),
      clvZ: Number(clvZ.toFixed(3)),
    };
  }

  const rawRes = evaluatePopulation(mergedAhObservations, 'Row-Level (Raw Multi-Bookmaker)');
  const dedupRes = evaluatePopulation(dedupedAhObservations, 'Fixture-Level (Deduplicated, Pinnacle-Priority)');

  console.log('\nSide-by-Side Comparison:');
  console.log('---------------------------------------------------------------------------------------------');
  console.log(`Metric                            | Row-Level (Raw)            | Fixture-Level (Deduplicated) `);
  console.log('---------------------------------------------------------------------------------------------');
  console.log(`Total Observations Evaluated      | ${rawRes.totalObsEvaluated.toString().padEnd(26)} | ${dedupRes.totalObsEvaluated.toString().padEnd(26)}`);
  console.log(`EV > 2% Bet Population (N)        | ${rawRes.evGt2Count.toString().padEnd(26)} | ${dedupRes.evGt2Count.toString().padEnd(26)}`);
  console.log(`Mean Theoretical EV               | ${(rawRes.meanEv + '%').padEnd(26)} | ${(dedupRes.meanEv + '%').padEnd(26)}`);
  console.log(`Total Net Profit (Units)          | ${(rawRes.totalProfit + ' u').padEnd(26)} | ${(dedupRes.totalProfit + ' u').padEnd(26)}`);
  console.log(`Realized ROI (%)                  | ${(rawRes.roi + '%').padEnd(26)} | ${(dedupRes.roi + '%').padEnd(26)}`);
  console.log(`Sample Variance per Bet           | ${rawRes.variance.toString().padEnd(26)} | ${dedupRes.variance.toString().padEnd(26)}`);
  console.log(`Standard Error (SE)               | ${(rawRes.sePercent + '%').padEnd(26)} | ${(dedupRes.sePercent + '%').padEnd(26)}`);
  console.log(`Analytical 95% CI                 | [${rawRes.analyticalCi[0]}%, ${rawRes.analyticalCi[1]}%]`.padEnd(29) + `| [${dedupRes.analyticalCi[0]}%, ${dedupRes.analyticalCi[1]}%]`);
  console.log(`Bootstrap 95% CI                  | [${rawRes.bootstrapCi[0]}%, ${rawRes.bootstrapCi[1]}%]`.padEnd(29) + `| [${dedupRes.bootstrapCi[0]}%, ${dedupRes.bootstrapCi[1]}%]`);
  console.log(`CLV Sample Size (N_clv)           | ${rawRes.clvN.toString().padEnd(26)} | ${dedupRes.clvN.toString().padEnd(26)}`);
  console.log(`CLV Mean (%)                      | ${(rawRes.clvMean + '%').padEnd(26)} | ${(dedupRes.clvMean + '%').padEnd(26)}`);
  console.log(`CLV Standard Error (SE)           | ${(rawRes.clvSe + '%').padEnd(26)} | ${(dedupRes.clvSe + '%').padEnd(26)}`);
  console.log(`CLV Z-statistic                   | ${rawRes.clvZ.toString().padEnd(26)} | ${dedupRes.clvZ.toString().padEnd(26)}`);
  console.log('---------------------------------------------------------------------------------------------');


  // -------------------------------------------------------------
  // ITEM 2: Pre-Registered Shrinkage Grid on AH-dixoncoles-v1
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log('ITEM 2: SHRINKAGE-BLENDED EVALUATION ON AH-DIXONCOLES-V1');
  console.log('Formula: p_final = (1 - s) * p_model + s * p_market');
  console.log('Grid: s in {0.00, 0.10, 0.20, 0.30}');
  console.log('Dataset: Full Historical Walk-Forward (Fixture-Level Deduplicated)');
  console.log('=============================================================\n');

  const shrinkageGrid = [0.00, 0.10, 0.20, 0.30];
  const shrinkageResults: any[] = [];

  const dedupObsByMatch = new Map<string, typeof dedupedAhObservations>();
  for (const obs of dedupedAhObservations) {
    const list = dedupObsByMatch.get(obs.canonicalId) || [];
    list.push(obs);
    dedupObsByMatch.set(obs.canonicalId, list);
  }

  for (const s of shrinkageGrid) {
    let flaggedCount = 0;
    let flaggedProfit = 0;
    let flaggedEvSum = 0;
    let allEvSum = 0;
    let allObsCount = 0;
    const flaggedReturns: number[] = [];
    const clvValues: number[] = [];
    const allEvValues: number[] = [];

    for (const fold of folds) {
      const trainMatches = matches.filter((m) => fold.trainSeasons.includes(m.season));
      let valMatches: any[];
      if (fold.valSeason === '2022-2026_CONFIRMATION') {
        valMatches = matches.filter((m) => ['2022-2023', '2023-2024', '2024-2025', '2025-2026'].includes(m.season));
      } else {
        valMatches = matches.filter((m) => m.season === fold.valSeason);
      }

      const fittedRho = AhProbabilityModels.fitDixonColesRho(trainMatches, (m) =>
        AhSharedStateEngine.computeState(m, trainMatches)
      );

      for (const valMatch of valMatches) {
        const priorHistory = matches.filter((m) => m.matchDate < valMatch.matchDate);
        const state = AhSharedStateEngine.computeState(valMatch, priorHistory);
        const dcMatrix = AhProbabilityModels.computeDixonColesMatrix(
          state.expectedHomeGoals,
          state.expectedAwayGoals,
          fittedRho
        );
        const dcGd = AhProbabilityModels.matrixToGoalDifferencePmf(dcMatrix);

        const matchObs = dedupObsByMatch.get(valMatch.canonicalId) || [];
        for (const obs of matchObs) {
          allObsCount++;
          const rawProbs = AhProbabilityModels.deriveAhSettlementProbabilities(dcGd, obs.line, obs.side);
          const devig = AhValueEngine.devig2WayAh(obs.takenOdds, 1.95);
          const pMarket = obs.side === 'home' ? devig.homeFairProb : devig.awayFairProb;

          // Apply Shrinkage Blending:
          // p_shrunk = (1 - s) * p_model + s * p_market
          const pCoverRaw = rawProbs.pCover;
          const pCoverShrunk = (1 - s) * pCoverRaw + s * pMarket;

          // Shrunk outcome probabilities scale proportionally:
          const scale = pCoverRaw > 0 ? pCoverShrunk / pCoverRaw : 1.0;
          const shrunkProbs = {
            ...rawProbs,
            pFullWin: rawProbs.pFullWin * scale,
            pHalfWin: rawProbs.pHalfWin * scale,
            pCover: pCoverShrunk,
            // Loss components adjust to balance remaining probability
            pFullLoss: Math.max(0, 1.0 - pCoverShrunk - rawProbs.pPush),
          };

          const ev = AhValueEngine.computeSettlementAwareEv(shrunkProbs, obs.takenOdds);
          allEvSum += ev;
          allEvValues.push(ev);

          const clv = AhValueEngine.computeClv(obs.takenOdds, obs.closingOdds);

          const settlement = settleAsianHandicap(
            obs.side,
            obs.line,
            obs.homeGoals,
            obs.awayGoals,
            obs.takenOdds
          );

          if (ev > 2.0) {
            flaggedCount++;
            flaggedProfit += settlement.profit;
            flaggedEvSum += ev;
            flaggedReturns.push(settlement.profit);
            if (clv !== undefined) clvValues.push(clv);
          }
        }
      }
    }

    const roi = flaggedCount > 0 ? (flaggedProfit / flaggedCount) * 100 : 0;
    const meanEvFlagged = flaggedCount > 0 ? flaggedEvSum / flaggedCount : 0;
    const meanEvAll = allObsCount > 0 ? allEvSum / allObsCount : 0;
    const flaggedPct = allObsCount > 0 ? (flaggedCount / allObsCount) * 100 : 0;

    const meanReturn = flaggedCount > 0 ? flaggedProfit / flaggedCount : 0;
    const variance = flaggedReturns.length > 1
      ? flaggedReturns.reduce((acc, x) => acc + Math.pow(x - meanReturn, 2), 0) / (flaggedReturns.length - 1)
      : 0;
    const se = Math.sqrt(variance / Math.max(1, flaggedReturns.length));
    const bootstrapCi = AhValueEngine.computeBootstrapCi(flaggedReturns, 2000);

    const clvMean = clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : 0;
    const clvVar = clvValues.length > 1
      ? clvValues.reduce((acc, x) => acc + Math.pow(x - clvMean, 2), 0) / (clvValues.length - 1)
      : 0;
    const clvSe = Math.sqrt(clvVar / Math.max(1, clvValues.length));
    const clvZ = clvSe > 0 ? clvMean / clvSe : 0;

    shrinkageResults.push({
      shrinkage: s,
      allObsCount,
      flaggedCount,
      flaggedPct: Number(flaggedPct.toFixed(1)),
      meanEvAll: Number(meanEvAll.toFixed(2)),
      meanEvFlagged: Number(meanEvFlagged.toFixed(2)),
      totalProfit: Number(flaggedProfit.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      variance: Number(variance.toFixed(4)),
      sePercent: Number((se * 100).toFixed(2)),
      bootstrapCi,
      clvN: clvValues.length,
      clvMean: Number(clvMean.toFixed(4)),
      clvSe: Number(clvSe.toFixed(4)),
      clvZ: Number(clvZ.toFixed(3)),
    });
  }

  console.log('Shrinkage Grid Results Table:');
  console.log('-------------------------------------------------------------------------------------------------------------------------------');
  console.log(`Shrinkage (s) | Flagged Bets (N) | Flagged % | Mean Flagged EV | Realized ROI | Bootstrap 95% CI     | CLV Mean | CLV Z-Stat `);
  console.log('-------------------------------------------------------------------------------------------------------------------------------');
  for (const r of shrinkageResults) {
    console.log(
      `s = ${r.shrinkage.toFixed(2)}    | ` +
      `${r.flaggedCount.toString().padEnd(16)} | ` +
      `${(r.flaggedPct + '%').padEnd(9)} | ` +
      `${(r.meanEvFlagged > 0 ? '+' + r.meanEvFlagged : r.meanEvFlagged) + '%'}`.padEnd(15) + ` | ` +
      `${(r.roi > 0 ? '+' + r.roi : r.roi) + '%'}`.padEnd(12) + ` | ` +
      `[${r.bootstrapCi[0]}%, ${r.bootstrapCi[1]}%]`.padEnd(20) + ` | ` +
      `${(r.clvMean > 0 ? '+' + r.clvMean : r.clvMean) + '%'}`.padEnd(8) + ` | ` +
      `${r.clvZ.toFixed(3)}`
    );
  }
  console.log('-------------------------------------------------------------------------------------------------------------------------------');
}

runInvestigation().catch(console.error);
