import * as fs from 'fs';
import * as path from 'path';
import { generatePremierLeagueAhResearch } from '../src/lib/research/premierLeagueAhEngine';

async function main() {
  console.log('=== RUNNING EPL ASIAN HANDICAP FORENSIC RESEARCH ===');
  const payload = generatePremierLeagueAhResearch();

  const outputDir = path.resolve(process.cwd(), 'data', 'research');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Output machine-readable JSON
  const jsonPath = path.join(outputDir, 'epl_ah_research_output.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[SUCCESS] Generated JSON artifact: ${jsonPath}`);

  // 2. Generate detailed Forensic Markdown Report
  const mdReport = `=== EPL AH RESEARCH FORENSIC REPORT ===

Seasons:
2024/25
2025/26

Expected fixtures:
${payload.dataIntegrity.expectedFixtures}

Verified result fixtures:
${payload.dataIntegrity.finalResultsVerified}

Verified AH fixtures:
${payload.dataIntegrity.ahRecordsAvailable}

AH 0:
${payload.dataIntegrity.ah0Records}

Positive AH:
${payload.dataIntegrity.ahPositiveRecords}

Negative AH:
${payload.dataIntegrity.ahNegativeRecords}

Bookmaker provenance:
${payload.dataIntegrity.bookmakerProvenance}

Historical odds provenance:
${payload.dataIntegrity.historicalOddsProvenance}

CLV:
${payload.dataIntegrity.clvProvenance}

Look-ahead:
${payload.dataIntegrity.lookAheadPassed ? 'PASS' : 'FAIL'}

Dummy data:
${payload.dataIntegrity.dummyDataPassed ? 'PASS' : 'FAIL'}

Settlement:
${payload.dataIntegrity.settlementEnginePassed ? 'PASS' : 'FAIL'}

Model:
${payload.modelValidation.modelName} (Brier: ${payload.modelValidation.brierScore}, LogLoss: ${payload.modelValidation.logLoss})

Research verdict:
${payload.manifest.verdict} — ${payload.manifest.verdictExplanation}
`;

  const mdPath = path.join(outputDir, 'EPL_AH_FORENSIC_REPORT.md');
  fs.writeFileSync(mdPath, mdReport, 'utf8');
  console.log(`[SUCCESS] Generated Markdown report: ${mdPath}`);

  console.log('\n' + mdReport);
}

main().catch((err) => {
  console.error('[ERROR] Research script failed:', err);
  process.exit(1);
});
