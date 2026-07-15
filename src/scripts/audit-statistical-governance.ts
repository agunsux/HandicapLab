#!/usr/bin/env tsx
// ============================================================================
// STATISTICAL GOVERNANCE AUDIT SCRIPT
// ============================================================================
// This script enforces the STATISTICAL_GOVERNANCE.md policies:
//   1. Check that no EV/Edge/CLV computation bypasses the de-vig layer
//   2. Check that all dashboard components check feature flags
//   3. Check that zero-data states use proper empty states
//   4. Generate a compliance report
//
// Run: npx tsx src/scripts/audit-statistical-governance.ts
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface AuditFinding {
  severity: 'ERROR' | 'WARN' | 'INFO';
  category: string;
  file: string;
  message: string;
}

class GovernanceAuditor {
  private findings: AuditFinding[] = [];
  private sourceRoot: string;

  constructor(sourceRoot: string) {
    this.sourceRoot = sourceRoot;
  }

  addFinding(severity: 'ERROR' | 'WARN' | 'INFO', category: string, file: string, message: string): void {
    this.findings.push({ severity, category, file, message });
  }

  get errorCount(): number {
    return this.findings.filter((f) => f.severity === 'ERROR').length;
  }

  get warnCount(): number {
    return this.findings.filter((f) => f.severity === 'WARN').length;
  }

  get totalFindings(): number {
    return this.findings.length;
  }

  /**
   * Check 1: Ensure no EV/Edge/CLV computation bypasses the de-vig layer.
   * We search for patterns like `1/odds - 1/closingOdds` or `odds * prob - 1`
   * that might compute EV/Edge/CLV without routing through devig.ts.
   */
  auditDeVigCompliance(): void {
    console.log('\n📊 Checking de-vig compliance...');

    const searchPaths = [
      path.join(this.sourceRoot, 'lib', 'market-intelligence'),
      path.join(this.sourceRoot, 'lib', 'engine'),
      path.join(this.sourceRoot, 'lib', 'closing-odds'),
      path.join(this.sourceRoot, 'lib', 'probability'),
      path.join(this.sourceRoot, 'services'),
    ];

    for (const dir of searchPaths) {
      if (!fs.existsSync(dir)) continue;
      this.walkFiles(dir, (filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relative = path.relative(this.sourceRoot, filePath);

        // Skip the canonical de-vig file itself
        if (relative.includes('settlement-core/devig.ts')) return;

        // Check for EV calculations that don't import from devig
        const hasProbTimesOdds = /prob\w*\s*\*\s*odds\s*-\s*1/.test(content);
        const hasEdgeCalc = /(edge|ev|expectedValue)\s*[=:]\s*/.test(content) &&
          /profitUnits|oddsTaken/.test(content);

        if ((hasProbTimesOdds || hasEdgeCalc) && !content.includes('from') && !content.includes('devig')) {
          this.addFinding(
            'WARN',
            'de-vig-bypass',
            relative,
            'Possible EV/edge calculation that may bypass de-vig layer. Verify it routes through settlement-core/devig.ts'
          );
        }

        // Check for raw CLV calculations
        const hasRawCLV = /1\s*\/\s*closingOdds/.test(content) && !content.includes('devig');
        if (hasRawCLV) {
          this.addFinding(
            'ERROR',
            'clv-without-devig',
            relative,
            'Raw CLV calculation detected that bypasses de-vig layer. Must route through settlement-core/devig.ts'
          );
        }
      });
    }
  }

  /**
   * Check 2: Ensure all metric display files handle zero-data states properly.
   */
  auditZeroDataStates(): void {
    console.log('📊 Checking zero-data states...');

    const componentDirs = [
      path.join(this.sourceRoot, 'components'),
      path.join(this.sourceRoot, 'app'),
    ];

    for (const dir of componentDirs) {
      if (!fs.existsSync(dir)) continue;
      this.walkFiles(dir, (filePath) => {
        if (!filePath.match(/\.(tsx|ts)$/)) return;
        const content = fs.readFileSync(filePath, 'utf-8');
        const relative = path.relative(this.sourceRoot, filePath);

        // Check for the anti-pattern: `?? 0` or `|| 0` for metric values
        const nullCoalesceZero = /\b(roi|clv|yield|strikeRate|profitLoss|edge|accuracy)\b.*\?\?\s*0/.test(content);
        const orZero = /\b(roi|clv|yield|strikeRate|profitLoss|edge|accuracy)\b.*\|\|\s*0/.test(content);

        if (nullCoalesceZero) {
          this.addFinding(
            'ERROR',
            'zero-data',
            relative,
            'Uses nullish coalescing with 0 for metric display. Should use "No verified data available" empty state instead.'
          );
        }

        if (orZero) {
          this.addFinding(
            'WARN',
            'zero-data',
            relative,
            'Uses || 0 fallback for metric display. Consider using descriptive empty state.'
          );
        }
      });
    }
  }

  /**
   * Check 3: Verify feature flag checks exist before premium displays.
   */
  auditFeatureFlagGating(): void {
    console.log('📊 Checking feature flag gating...');

    const premiumFeatures = ['CLV', 'clv', 'ROI', 'roi', 'Yield', 'yield', 'Calibration'];
    const componentDirs = [
      path.join(this.sourceRoot, 'components'),
      path.join(this.sourceRoot, 'app'),
    ];

    for (const dir of componentDirs) {
      if (!fs.existsSync(dir)) continue;
      this.walkFiles(dir, (filePath) => {
        if (!filePath.match(/\.(tsx|ts)$/)) return;
        const content = fs.readFileSync(filePath, 'utf-8');
        const relative = path.relative(this.sourceRoot, filePath);

        for (const feature of premiumFeatures) {
          if (content.includes(feature) && !content.includes('feature_flag') && !content.includes('FeatureFlag') && !content.includes('isEnabled') && !content.includes('isAccessible')) {
            this.addFinding(
              'INFO',
              'flag-gating',
              relative,
              `References "${feature}" but no feature flag check detected. Verify it's properly gated.`
            );
          }
        }
      });
    }
  }

  /**
   * Check 4: Verify STATISTICAL_GOVERNANCE.md exists and is up to date.
   */
  auditGovernanceDocument(): void {
    console.log('📊 Checking governance document...');
    const govPath = path.join(this.sourceRoot, '..', 'STATISTICAL_GOVERNANCE.md');
    if (!fs.existsSync(govPath)) {
      this.addFinding(
        'ERROR',
        'documentation',
        'STATISTICAL_GOVERNANCE.md',
        'STATISTICAL_GOVERNANCE.md is missing. This is the single source of truth for metric definitions.'
      );
    } else {
      const content = fs.readFileSync(govPath, 'utf-8');
      if (!content.includes('De-Vig Methodology')) {
        this.addFinding('ERROR', 'documentation', 'STATISTICAL_GOVERNANCE.md', 'Missing De-Vig Methodology section.');
      }
      if (!content.includes('Dashboard Quality Gate')) {
        this.addFinding('ERROR', 'documentation', 'STATISTICAL_GOVERNANCE.md', 'Missing Dashboard Quality Gate section.');
      }
      if (!content.includes('Feature Flag Gating')) {
        this.addFinding('ERROR', 'documentation', 'STATISTICAL_GOVERNANCE.md', 'Missing Feature Flag Gating section.');
      }
    }
  }

  /**
   * Generate a full compliance report.
   */
  generateReport(): string {
    const lines: string[] = [
      '=========================================================',
      '  STATISTICAL GOVERNANCE AUDIT REPORT',
      '=========================================================',
      `  Generated: ${new Date().toISOString()}`,
      `  Total Findings: ${this.totalFindings}`,
      `  Errors: ${this.errorCount}`,
      `  Warnings: ${this.warnCount}`,
      '=========================================================',
      '',
    ];

    if (this.findings.length === 0) {
      lines.push('  ✅ PASSED — No compliance issues found.');
      lines.push('');
      return lines.join('\n');
    }

    const bySeverity = ['ERROR', 'WARN', 'INFO'] as const;
    for (const severity of bySeverity) {
      const items = this.findings.filter((f) => f.severity === severity);
      if (items.length === 0) continue;

      const icon = severity === 'ERROR' ? '❌' : severity === 'WARN' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} ${severity} (${items.length}):`);
      lines.push('');

      for (const item of items) {
        lines.push(`    [${item.category}] ${item.file}`);
        lines.push(`    ${item.message}`);
        lines.push('');
      }
    }

    if (this.errorCount > 0) {
      lines.push('  ❌ FAILED — Fix errors before proceeding to next epic.');
    } else if (this.warnCount > 0) {
      lines.push('  ⚠️ PASSED WITH WARNINGS — Review warnings before release.');
    } else {
      lines.push('  ✅ PASSED — All checks clear.');
    }

    lines.push('=========================================================');
    return lines.join('\n');
  }

  private walkFiles(dir: string, callback: (filePath: string) => void): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('node_modules') && !entry.name.startsWith('.')) {
          this.walkFiles(fullPath, callback);
        } else if (entry.isFile()) {
          callback(fullPath);
        }
      }
    } catch (err) {
      // Directory may not exist — skip
    }
  }
}

// Main execution
async function main() {
  console.log('🔍 HandicapLab Statistical Governance Auditor');
  console.log('===============================================');

  const srcDir = path.resolve(__dirname, '..');
  const auditor = new GovernanceAuditor(srcDir);

  auditor.auditGovernanceDocument();
  auditor.auditDeVigCompliance();
  auditor.auditZeroDataStates();
  auditor.auditFeatureFlagGating();

  const report = auditor.generateReport();
  console.log(report);

  // Save report
  const reportPath = path.resolve(__dirname, '..', '..', 'GOVERNANCE_AUDIT_REPORT.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  process.exit(auditor.errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});