// EPIC 56 — Detailed Verification & Diagnostics Audit
// Location: src/scripts/audit-questions.ts

import { AhDataLoader } from '../lib/research/ah-solo/ahDataLoader';
import { AhTournamentRunner } from '../lib/research/ah-solo/ahTournamentRunner';
import { AhValueEngine } from '../lib/research/ah-solo/ahValueEngine';
import { AhSharedStateEngine } from '../lib/research/ah-solo/ahSharedState';
import { AhProbabilityModels } from '../lib/research/ah-solo/ahProbabilityModels';
import { settleAsianHandicap } from '../lib/research/ah-solo/ahSettlementEngine';

async function main() {
  console.log('=== EPIC 56 DEEP AUDIT ===\n');

  const { matches, inventory, mergedAhObservations } = AhDataLoader.computeDataInventory();
  console.log(`Matches count: ${matches.length}`);
  console.log(`Merged AH obs count: ${mergedAhObservations.length}`);

  const matchMap = new Map();
  for (const m of matches) matchMap.set(m.canonicalId, m);

  // Group by canonicalId
  const obsByMatch = new Map();
  for (const obs of mergedAhObservations) {
    const list = obsByMatch.get(obs.canonicalId) || [];
    list.push(obs);
    obsByMatch.set(obs.canonicalId, list);
  }

  // Let's inspect all predictions and investigate EV vs ROI
  let totalEvaluated = 0;
  let evGt2Count = 0;
  let evGt2Stakes = 0;
  let evGt2Profit = 0;
  let evGt2EvSum = 0;

  const evGt2Records: any[] = [];
  const betReturns: number[] = [];
  const clvValues: number[] = [];

  // Re-run the walk-forward validation step by step
  const folds = AhTournamentRunner.createFolds(matches);

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
        totalEvaluated++;
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
          evGt2Stakes += 1.0;
          evGt2Profit += settlement.profit;
          evGt2EvSum += ev;
          betReturns.push(settlement.profit);
          evGt2Records.push({
            canonicalId: obs.canonicalId,
            matchDate: obs.matchDate,
            homeTeam: obs.homeTeam,
            awayTeam: obs.awayTeam,
            score: `${obs.homeGoals}-${obs.awayGoals}`,
            side: obs.side,
            line: obs.line,
            takenOdds: obs.takenOdds,
            closingOdds: obs.closingOdds,
            clv,
            ev,
            probs: lineProbs,
            outcome: settlement.outcome,
            profit: settlement.profit,
          });
        }
      }
    }
  }

  console.log(`Total AH trades evaluated: ${totalEvaluated}`);
  console.log(`Bets with EV > 2%: ${evGt2Count}`);
  console.log(`Average EV for EV > 2% bets: ${(evGt2EvSum / evGt2Count).toFixed(2)}%`);
  console.log(`Total profit for EV > 2% bets: ${evGt2Profit.toFixed(2)} units`);
  console.log(`Realized ROI for EV > 2% bets: ${((evGt2Profit / evGt2Stakes) * 100).toFixed(2)}%`);

  // QUESTION 1: Trace 10 individual bets
  console.log('\n--- 10 DETAILED BET TRACES WITH EV > 2% ---');
  for (let i = 0; i < Math.min(10, evGt2Records.length); i++) {
    const r = evGt2Records[i];
    console.log(`\nBet #${i + 1}: ${r.canonicalId} (${r.matchDate})`);
    console.log(`  Teams: ${r.homeTeam} vs ${r.awayTeam} | Result: ${r.score}`);
    console.log(`  Selection: ${r.side.toUpperCase()} Line ${r.line >= 0 ? '+' + r.line : r.line} @ Taken Odds ${r.takenOdds}`);
    console.log(`  Model Probabilities: FW=${r.probs.pFullWin}, HW=${r.probs.pHalfWin}, Push=${r.probs.pPush}, HL=${r.probs.pHalfLoss}, FL=${r.probs.pFullLoss}`);
    console.log(`  Calculated EV: ${r.ev}% | Settlement Outcome: ${r.outcome} | Net Profit: ${r.profit > 0 ? '+' + r.profit : r.profit} units`);
  }

  // QUESTION 2: Bootstrap CI Analysis
  console.log('\n--- QUESTION 2: BOOTSTRAP CI ARITHMETIC ---');
  console.log(`Number of individual bet returns resampled: ${betReturns.length}`);
  const meanReturn = evGt2Profit / evGt2Stakes; // in units per bet
  const variance = betReturns.reduce((s, x) => s + Math.pow(x - meanReturn, 2), 0) / (betReturns.length - 1);
  const stdError = Math.sqrt(variance / betReturns.length);
  console.log(`Mean return per unit staked: ${meanReturn.toFixed(4)} units (= ${(meanReturn * 100).toFixed(2)}%)`);
  console.log(`Sample variance: ${variance.toFixed(4)} | Standard Error (SE): ${stdError.toFixed(4)} units (= ${(stdError * 100).toFixed(2)}%)`);
  console.log(`Theoretical Analytical 95% CI (Mean ± 1.96*SE): [${((meanReturn - 1.96 * stdError) * 100).toFixed(2)}%, ${((meanReturn + 1.96 * stdError) * 100).toFixed(2)}%]`);

  // Run 1000 bootstrap on percentage scale
  const bootstrapPercents: number[] = [];
  for (let iter = 0; iter < 1000; iter++) {
    let sum = 0;
    for (let j = 0; j < betReturns.length; j++) {
      const idx = Math.floor(Math.random() * betReturns.length);
      sum += betReturns[idx];
    }
    bootstrapPercents.push((sum / betReturns.length) * 100);
  }
  bootstrapPercents.sort((a, b) => a - b);
  const bootLow = bootstrapPercents[Math.floor(1000 * 0.025)];
  const bootHigh = bootstrapPercents[Math.floor(1000 * 0.975)];
  console.log(`Corrected Bootstrap 95% CI (in % scale): [${bootLow.toFixed(2)}%, ${bootHigh.toFixed(2)}%]`);

  // QUESTION 3: CLV Statistics
  console.log('\n--- QUESTION 3: CLV STATISTICAL SIGNIFICANCE ---');
  console.log(`Total valid CLV observations: ${clvValues.length}`);
  const meanClv = clvValues.reduce((a, b) => a + b, 0) / clvValues.length;
  const clvVar = clvValues.reduce((s, x) => s + Math.pow(x - meanClv, 2), 0) / (clvValues.length - 1);
  const clvSe = Math.sqrt(clvVar / clvValues.length);
  const zStat = meanClv / clvSe;
  console.log(`Mean CLV: ${meanClv.toFixed(4)}% | Variance: ${clvVar.toFixed(4)} | SE: ${clvSe.toFixed(4)}%`);
  console.log(`Z-statistic (Mean / SE): ${zStat.toFixed(3)}`);
  console.log(`Is CLV statistically distinguishable from 0.00% at alpha=0.05 (|z| > 1.96)? ${Math.abs(zStat) > 1.96 ? 'YES' : 'NO'}`);
}

main().catch(console.error);
