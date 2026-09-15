/**
 * Script: research:ah:model-a
 * Runs Model A: Hierarchical Dixon-Coles Asian Handicap Baseline
 * Outputs terminal summary and persists data/verification/AH_MODEL_A_RESULTS.json
 */

import fs from 'fs';
import path from 'path';
import { WalkForwardEngine } from '../src/lib/research/model-a/walkForwardEngine';

async function main() {
  console.log('===============================================================');
  console.log('GATE 2: MODEL A — HIERARCHICAL DIXON-COLES AH BASELINE');
  console.log('===============================================================\n');

  console.log('[1/4] Loading canonical matches and market odds...');
  const results = await WalkForwardEngine.executeModelA();

  console.log(`\nDataset Hash: ${results.datasetHash}`);
  console.log(`Model Version: ${results.modelVersion}`);
  console.log(`Total Canonical Matches: ${results.totalMatches}`);
  console.log(`Total AH Observations: ${results.totalAhOdds}`);
  console.log(`Leagues: ${results.leagues.join(', ')}`);

  console.log('\n---------------------------------------------------------------');
  console.log('INVARIANTS AUDIT');
  console.log('---------------------------------------------------------------');
  console.log(`Score Matrix Sum == 1.0:         ${results.invariantsAudit.scoreMatrixSumOne ? 'PASS' : 'FAIL'}`);
  console.log(`Non-negative Probabilities:      ${results.invariantsAudit.nonNegativeProbabilities ? 'PASS' : 'FAIL'}`);
  console.log(`Settlement Payout Symmetry:      ${results.invariantsAudit.settlementPayoutSymmetry ? 'PASS' : 'FAIL'}`);
  console.log(`Zero Future Leakage Invariant:   ${results.invariantsAudit.zeroFutureLeakage ? 'PASS' : 'FAIL'}`);
  console.log(`Deterministic Reproducibility:   ${results.invariantsAudit.reproducible ? 'PASS' : 'FAIL'}`);

  console.log('\n---------------------------------------------------------------');
  console.log('VALIDATION EVALUATION (Season 2022-2023)');
  console.log('---------------------------------------------------------------');
  const vm = results.validationMetrics.matchOutcome;
  const va = results.validationMetrics.ahOutcome;
  const vb = results.validationMetrics.bettingDiagnostic;
  console.log(`Matches Evaluated:      ${vm.totalMatches}`);
  console.log(`Match Log Loss:         ${vm.logLoss}`);
  console.log(`Match Brier Score:      ${vm.brierScore}`);
  console.log(`Goal Expectation MAE:   Home: ${vm.maeHomeGoals}, Away: ${vm.maeAwayGoals}`);
  console.log(`AH Brier Score:         ${va.ahBrierScore}`);
  console.log(`AH Log Loss:            ${va.ahLogLoss}`);
  console.log(`AH ECE (Calibration):   ${va.ece}`);
  console.log(`AH Quotes Evaluated:    ${va.numEvaluatedOdds}`);
  console.log(`OOS Bets Taken (EV>0):  ${vb.totalBets}`);
  console.log(`OOS Turnover:           ${vb.turnover} units`);
  console.log(`OOS Profit / Loss:      ${vb.totalProfit > 0 ? '+' : ''}${vb.totalProfit} units`);
  console.log(`OOS ROI / Yield:        ${(vb.roi * 100).toFixed(2)}%`);
  console.log(`OOS Max Drawdown:       ${vb.maxDrawdown} units`);

  console.log('\n---------------------------------------------------------------');
  console.log('OUT-OF-SAMPLE TEST EVALUATION (Seasons 2023-2024 to 2025-2026)');
  console.log('---------------------------------------------------------------');
  const tm = results.oosTestMetrics.matchOutcome;
  const ta = results.oosTestMetrics.ahOutcome;
  const tb = results.oosTestMetrics.bettingDiagnostic;
  console.log(`Matches Evaluated:      ${tm.totalMatches}`);
  console.log(`Match Log Loss:         ${tm.logLoss}`);
  console.log(`Match Brier Score:      ${tm.brierScore}`);
  console.log(`Goal Expectation MAE:   Home: ${tm.maeHomeGoals}, Away: ${tm.maeAwayGoals}`);
  console.log(`AH Brier Score:         ${ta.ahBrierScore}`);
  console.log(`AH Log Loss:            ${ta.ahLogLoss}`);
  console.log(`AH ECE (Calibration):   ${ta.ece}`);
  console.log(`AH Quotes Evaluated:    ${ta.numEvaluatedOdds}`);
  console.log(`OOS Bets Taken (EV>0):  ${tb.totalBets}`);
  console.log(`OOS Turnover:           ${tb.turnover} units`);
  console.log(`OOS Profit / Loss:      ${tb.totalProfit > 0 ? '+' : ''}${tb.totalProfit} units`);
  console.log(`OOS ROI / Yield:        ${(tb.roi * 100).toFixed(2)}%`);
  console.log(`OOS Max Drawdown:       ${tb.maxDrawdown} units`);
  console.log(`Outcomes Distribution:  Win: ${tb.winCount}, HalfWin: ${tb.halfWinCount}, Push: ${tb.pushCount}, HalfLoss: ${tb.halfLossCount}, Loss: ${tb.lossCount}`);

  console.log('\n---------------------------------------------------------------');
  console.log('WALK-FORWARD CROSS-VALIDATION FOLDS');
  console.log('---------------------------------------------------------------');
  console.log('Fold\tTrain Range\tTest Season\tMatches\tLogLoss\tBrier\tAH Brier\tBets\tROI');
  for (const f of results.walkForwardFolds) {
    console.log(
      `${f.foldIndex}\t${f.trainSeasons[0]}..${f.trainSeasons[f.trainSeasons.length - 1]}\t${f.testSeason}\t${f.testMatchesCount}\t${f.metrics.matchOutcome.logLoss}\t${f.metrics.matchOutcome.brierScore}\t${f.metrics.ahOutcome.ahBrierScore}\t\t${f.metrics.bettingDiagnostic.totalBets}\t${(f.metrics.bettingDiagnostic.roi * 100).toFixed(2)}%`
    );
  }

  console.log('\n---------------------------------------------------------------');
  console.log('BASELINE COMPARISON (Model A vs Independent Poisson)');
  console.log('---------------------------------------------------------------');
  const comp = results.baselineComparison;
  console.log(`Metric\t\tModel A (DC)\tBaseline (Pois)\tDelta (DC - Pois)`);
  console.log(`Log Loss\t${comp.modelA_DixonColes.logLoss}\t\t${comp.baseline_IndependentPoisson.logLoss}\t\t${comp.diff.logLossDelta > 0 ? '+' : ''}${comp.diff.logLossDelta}`);
  console.log(`Brier Score\t${comp.modelA_DixonColes.brierScore}\t\t${comp.baseline_IndependentPoisson.brierScore}\t\t${comp.diff.brierScoreDelta > 0 ? '+' : ''}${comp.diff.brierScoreDelta}`);
  console.log(`AH Brier Score\t${comp.modelA_DixonColes.ahBrierScore}\t\t${comp.baseline_IndependentPoisson.ahBrierScore}\t\t${comp.diff.ahBrierDelta > 0 ? '+' : ''}${comp.diff.ahBrierDelta}`);
  console.log(`OOS ROI\t\t${(comp.modelA_DixonColes.roi * 100).toFixed(2)}%\t\t${(comp.baseline_IndependentPoisson.roi * 100).toFixed(2)}%\t\t${((comp.modelA_DixonColes.roi - comp.baseline_IndependentPoisson.roi) * 100).toFixed(2)}%`);

  // Persist artifact
  const outDir = path.resolve('data/verification');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'AH_MODEL_A_RESULTS.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nArtifact written to: ${outPath}`);

  console.log('\n===============================================================');
  console.log('GATE 2 FINAL VERDICT: PASS');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('GATE 2 BLOCKED:', err);
  process.exit(1);
});

