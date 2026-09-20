// ============================================================================
// DATA CONTAMINATION & SYNTHETIC DATA AUDIT
// ============================================================================
// Location: scripts/audit/data_contamination_audit.ts
//
// Scans production pipelines, repositories, and caches for any prohibited
// synthetic, dummy, mock, or placeholder match/prediction/odds records.
// Asserts ZERO contamination in production reads.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

export interface ContaminationFinding {
  location: string;
  pattern: string;
  lineSnippet: string;
  severity: 'CRITICAL' | 'WARNING';
}

export function runDataContaminationAudit(): {
  passed: boolean;
  totalCheckedFiles: number;
  criticalViolations: number;
  findings: ContaminationFinding[];
} {
  const findings: ContaminationFinding[] = [];

  // 1. Audit active production caches
  const cacheFiles = [
    'data/cache/canonical_fixtures.json',
    'data/cache/oddspapi_pl_fixtures.json',
  ];

  const prohibitedPatterns = [
    'fixture_test_',
    'mock_fixture',
    'dummy_match',
    'synthetic_odds',
    'fake_prediction',
    'placeholder_odds',
  ];

  let totalCheckedFiles = 0;

  for (const cf of cacheFiles) {
    const full = path.resolve(cf);
    if (fs.existsSync(full)) {
      totalCheckedFiles++;
      const raw = fs.readFileSync(full, 'utf8');
      for (const pat of prohibitedPatterns) {
        if (raw.toLowerCase().includes(pat)) {
          findings.push({
            location: cf,
            pattern: pat,
            lineSnippet: pat,
            severity: 'CRITICAL',
          });
        }
      }
    }
  }

  // 2. Audit core production pipeline source files (excluding tests & docs)
  const productionSourceFiles = [
    'src/lib/daily-picks/engine.ts',
    'src/lib/pipeline/canonicalOrchestrator.ts',
    'src/lib/services/canonicalFixtureRegistry.ts',
    'src/lib/config/multiLeagueRegistry.ts',
    'src/lib/validation/multiLeagueGates.ts',
    'src/lib/providers/oddspapiQuotaAllocator.ts',
  ];

  for (const sf of productionSourceFiles) {
    const full = path.resolve(sf);
    if (fs.existsSync(full)) {
      totalCheckedFiles++;
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lower = line.toLowerCase();
        // Disallow hardcoded fake odds values in production pipelines
        if (
          lower.includes('fake_odds') ||
          lower.includes('mock_match') ||
          (lower.includes('dummy_') && !lower.includes('dummy.test'))
        ) {
          findings.push({
            location: `${sf}:${idx + 1}`,
            pattern: 'dummy/mock in production pipeline',
            lineSnippet: line.trim(),
            severity: 'CRITICAL',
          });
        }
      });
    }
  }

  const criticalViolations = findings.filter((f) => f.severity === 'CRITICAL').length;
  const passed = criticalViolations === 0;

  return {
    passed,
    totalCheckedFiles,
    criticalViolations,
    findings,
  };
}

if (require.main === module) {
  const result = runDataContaminationAudit();
  console.log('=== DATA CONTAMINATION AUDIT RESULT ===');
  console.log(`Files Checked: ${result.totalCheckedFiles}`);
  console.log(`Critical Violations: ${result.criticalViolations}`);
  console.log(`Audit Passed: ${result.passed}`);
  if (result.findings.length > 0) {
    console.table(result.findings);
    process.exit(1);
  } else {
    console.log('Zero contamination detected in production pathways.');
  }
}

