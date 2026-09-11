// AH YIELD ENGINE — validation runner.
// Reads the frozen real datasets, runs the full engine, writes:
//   data/verification/AH_YIELD_ENGINE_REPORT.json  (machine-readable, full)
//   reports/AH_ENGINE_VALIDATION_REPORT.md          (human-readable)
//
// Usage: npx tsx scripts/ah-yield-validation.ts
// No network access. Fails closed when required data is missing.

import * as fs from 'fs';
import * as path from 'path';
import { runAhYieldValidation } from '../src/lib/research/ah-yield/ahEngine';
import { renderAhValidationMarkdown } from '../src/lib/research/ah-yield/ahReport';

function main(): void {
  const started = Date.now();
  const report = runAhYieldValidation({ bootstrapIterations: 1000 });

  const verificationDir = path.join(process.cwd(), 'data', 'verification');
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(verificationDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const jsonPath = path.join(verificationDir, 'AH_YIELD_ENGINE_REPORT.json');
  const mdPath = path.join(reportsDir, 'AH_ENGINE_VALIDATION_REPORT.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, renderAhValidationMarkdown(report));

  console.log(`AH engine validation complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`- canonical matches: ${report.datasetVersion.canonicalMatches}`);
  console.log(`- AH odds rows: ${report.datasetVersion.ahOddsRows}`);
  console.log(`- valid observations: ${report.dataQuality.ahOdds.validObservations}`);
  console.log(`- settlement self-check: ${report.settlementSelfCheck.passed}/${report.settlementSelfCheck.checked} passed`);
  console.log(`- headline cohort: ${report.headlineCohortKey}`);
  for (const cohort of report.cohorts) {
    console.log(
      `  [${cohort.cohortKey}] bets=${cohort.metrics.evaluatedBets} yield=${cohort.metrics.yieldPct.toFixed(2)}% pnl=${cohort.metrics.totalPnl.toFixed(1)}`
    );
  }
  console.log(`- JSON: ${jsonPath}`);
  console.log(`- Markdown: ${mdPath}`);
}

main();
