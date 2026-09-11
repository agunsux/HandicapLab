// AH INFORMATION ADVANTAGE RESEARCH — Main Execution Script.
// Evaluates pre-closing information advantage under strict snapshot semantics and zero closing leakage.
// Writes:
//   - AH_INFORMATION_ADVANTAGE_REPORT.md (root)
//   - data/verification/AH_INFORMATION_ADVANTAGE_REPORT.json
// Usage: npx tsx scripts/run-ah-info-advantage-research.ts

import * as fs from 'fs';
import * as path from 'path';
import {
  buildInfoDataset,
  auditTimestampProvenance,
  evaluateTwoPointEfficiency,
  runAblationMatrix,
  runEarlyVsClosingComparison,
  runLineMovementStudy,
  runClvDecompositionStudy,
  runIncrementalInformationTests,
  runLeagueStabilityStudy,
  runRobustnessSlices,
  runMultipleTestingAudit,
  determineFinalVerdict,
  generateReportMarkdown,
  type FullReportPayload,
} from '../src/lib/research/ah-info-advantage';

async function main() {
  console.log('================================================================');
  console.log('HANDICAPLAB — AH PRE-CLOSING INFORMATION ADVANTAGE RESEARCH');
  console.log('================================================================\n');

  const started = Date.now();

  // 1. Dataset Loading & Feature Engineering
  console.log('[1/7] Loading canonical datasets and computing point-in-time features...');
  const matches = buildInfoDataset();
  console.log(`[INFO] Loaded ${matches.length} canonical European matches with AH coverage.`);

  // 2. Timestamp Provenance Audit
  console.log('\n[2/7] Auditing timestamp availability & snapshot semantics...');
  const timestampAudit = auditTimestampProvenance();
  console.log(`[AUDIT] Snapshot semantics: ${timestampAudit.snapshotLabelsAvailable.join(' vs ')}`);
  console.log(`[AUDIT] Intraday classification: ${timestampAudit.dataClassification}`);

  // 3. Ablation Matrix Execution (M0 - M7, F0)
  console.log('\n[3/7] Executing pre-registered Ablation Matrix (M0..M7, F0) OOS walk-forward...');
  const { runResult, ablationStats } = runAblationMatrix(matches);
  console.log(`[INFO] Completed ${runResult.folds.length} walk-forward folds.`);
  console.log(`[RESULTS] M0 Market Brier: ${ablationStats.M0.brier} | ROI: ${ablationStats.M0.evPositiveRoi}%`);
  console.log(`[RESULTS] M7 All-Info Brier: ${ablationStats.M7.brier} | ROI: ${ablationStats.M7.evPositiveRoi}%`);
  console.log(`[RESULTS] F0 Football Brier: ${ablationStats.F0.brier} | ROI: ${ablationStats.F0.evPositiveRoi}%`);

  // 4. Early vs Closing Comparison
  console.log('\n[4/7] Executing Early vs Closing Market Dynamics...');
  const earlyVsClosing = runEarlyVsClosingComparison(matches);
  const twoPointEfficiency = evaluateTwoPointEfficiency(
    earlyVsClosing.earlyMarketStats.brier,
    earlyVsClosing.closingMarketStats.brier,
    earlyVsClosing.earlyMarketStats.logLoss,
    earlyVsClosing.closingMarketStats.logLoss,
    earlyVsClosing.earlyMarketStats.ece,
    earlyVsClosing.closingMarketStats.ece
  );
  console.log(`[COMPARE] Early Market Brier: ${earlyVsClosing.earlyMarketStats.brier}`);
  console.log(`[COMPARE] Closing Market Brier: ${earlyVsClosing.closingMarketStats.brier} (Δ: -${twoPointEfficiency.brierImprovement})`);
  console.log(`[COMPARE] Early + Football Brier: ${earlyVsClosing.earlyPlusFootballStats.brier}`);
  console.log(`[COMPARE] Early + Football + Movement Brier: ${earlyVsClosing.earlyPlusFootballPlusMovementStats.brier}`);

  // 5. Line Movement & CLV Studies
  console.log('\n[5/7] Executing Line Movement & CLV Studies...');
  const m7Predictions = runResult.predictionsByModel['M7'];
  const lineMovementResults = runLineMovementStudy(matches, m7Predictions);
  const clvDecomposition = runClvDecompositionStudy(m7Predictions);
  console.log(`[CLV] Mean CLV: ${clvDecomposition.avgClv}% | Realized ROI: ${clvDecomposition.realizedRoiAll}%`);
  console.log(`[CLV] Pearson Correlation (CLV vs ROI): r = ${clvDecomposition.clvToRoiPearsonCorr}`);

  // 6. Incremental Testing, League Stability, Slices & Multi-Comparison
  console.log('\n[6/7] Computing paired incremental tests, league stability & FDR audit...');
  const incrementalTests = runIncrementalInformationTests(
    ablationStats,
    earlyVsClosing.earlyPlusFootballPlusMovementStats
  );
  const leagueStability = runLeagueStabilityStudy(matches);
  const robustnessSlices = runRobustnessSlices(m7Predictions);

  const hypotheses = incrementalTests.map((t, idx) => ({
    id: `H${idx + 1}_${t.augmentedModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
    desc: `Incremental edge from ${t.testedAddition}`,
    pValue: t.deltaBrier < 0 ? t.pValue : 1.0,
  }));
  const multipleTestingAudit = runMultipleTestingAudit(hypotheses);

  // 7. Determine Final Verdict & Generate Artifacts
  console.log('\n[7/7] Synthesizing Final Verdict & generating audited reports...');
  const verdict = determineFinalVerdict({
    ablationStats,
    earlyVsClosing,
    clvDecomposition,
    incrementalTests,
  });

  const payload: FullReportPayload = {
    generatedAt: new Date().toISOString(),
    timestampAudit,
    twoPointEfficiency,
    ablationStats,
    earlyVsClosing,
    lineMovementResults,
    clvDecomposition,
    incrementalTests,
    leagueStability,
    robustnessSlices,
    multipleTestingAudit,
    verdict,
  };

  const mdReport = generateReportMarkdown(payload);

  // Write root Markdown report
  const rootReportPath = path.resolve(process.cwd(), 'AH_INFORMATION_ADVANTAGE_REPORT.md');
  fs.writeFileSync(rootReportPath, mdReport, 'utf8');
  console.log(`[SUCCESS] Generated markdown report: ${rootReportPath}`);

  // Write verification JSON artifact
  const verifDir = path.resolve(process.cwd(), 'data', 'verification');
  if (!fs.existsSync(verifDir)) fs.mkdirSync(verifDir, { recursive: true });
  const jsonReportPath = path.join(verifDir, 'AH_INFORMATION_ADVANTAGE_REPORT.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[SUCCESS] Generated JSON artifact: ${jsonReportPath}`);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n================================================================`);
  console.log(`FINAL VERDICT: [${verdict.verdictCode}] ${verdict.verdictLabel}`);
  console.log(`DESCRIPTION: ${verdict.verdictDescription}`);
  console.log(`EXECUTION TIME: ${elapsed}s`);
  console.log(`================================================================\n`);
}

main().catch((err) => {
  console.error('[ERROR] Research execution failed:', err);
  process.exit(1);
});
