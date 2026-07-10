/**
 * Sprint A12 — Reporting
 * =======================
 * Pure report generators for the Historical Evidence Platform.
 *
 * Produces: Dataset Report, Integrity Report, Coverage Report, Manifest,
 * and Validation Report in Markdown, JSON, and CSV.
 *
 * All functions are pure and deterministic (aside from embedded timestamps
 * already present in the inputs).
 */

import type { DatasetValidationReport } from '../dataset/types';
import type {
  CoverageMetric,
  CoverageReport,
  DatasetRegistryEntry,
  EvidenceDatasetManifest,
  IntegrityReport,
  LeagueCoverageSummary,
} from './types';

// ─── Generic ─────────────────────────────────────────────────────────────

export function toJSON(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function pct(m: CoverageMetric): string {
  return `${m.pct.toFixed(1)}%`;
}

// ─── Manifest ──────────────────────────────────────────────────────────────

export function manifestToJSON(manifest: EvidenceDatasetManifest): string {
  return toJSON(manifest);
}

// ─── Dataset Report ──────────────────────────────────────────────────────

export function datasetReportMarkdown(
  entry: DatasetRegistryEntry,
  manifest: EvidenceDatasetManifest
): string {
  const lines: string[] = [];
  lines.push(`# Dataset Report — ${entry.id}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| Dataset ID | ${entry.id} |`);
  lines.push(`| Provider | ${entry.provider} |`);
  lines.push(`| League | ${entry.leagueId} |`);
  lines.push(`| Season | ${entry.seasonId} |`);
  lines.push(`| Version | ${entry.version} |`);
  lines.push(`| Status | ${entry.status} |`);
  lines.push(`| Rows | ${entry.rowCount} |`);
  lines.push(`| Integrity Score | ${entry.integrityScore}/100 |`);
  lines.push(`| Checksum | \`${entry.checksum.slice(0, 16)}…\` |`);
  lines.push(`| Fingerprint | \`${entry.fingerprint.slice(0, 16)}…\` |`);
  lines.push(`| File Size | ${entry.fileSize} bytes |`);
  lines.push(`| Source | ${entry.sourcePath} |`);
  lines.push(`| Imported At | ${entry.importedAt} |`);
  lines.push(`| Schema | ${entry.schemaVersion} |`);
  lines.push('');
  lines.push(`## Validation Summary`);
  lines.push('');
  lines.push(`- Valid: ${manifest.validationSummary.valid ? '✅' : '❌'}`);
  lines.push(`- Fixtures: ${manifest.validationSummary.validFixtures}/${manifest.validationSummary.totalFixtures}`);
  lines.push(`- Errors: ${manifest.validationSummary.errorCount}`);
  lines.push(`- Warnings: ${manifest.validationSummary.warningCount}`);
  lines.push(`- Duplicate rows: ${manifest.duplicateRows}`);
  lines.push(`- Invalid rows: ${manifest.invalidRows}`);
  if (manifest.missingFields.length > 0) {
    lines.push(`- Missing fields: ${manifest.missingFields.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ─── Integrity Report ──────────────────────────────────────────────────────

export function integrityReportMarkdown(report: IntegrityReport): string {
  const lines: string[] = [];
  lines.push(`# Integrity Report — ${report.datasetId}`);
  lines.push('');
  lines.push(`**Score:** ${report.score}/100`);
  lines.push('');
  lines.push(`- Checks passed: ${report.passedChecks}/${report.totalChecks}`);
  lines.push(`- Errors: ${report.errorCount}`);
  lines.push(`- Warnings: ${report.warningCount}`);
  lines.push(`- Validation version: ${report.validationVersion}`);
  lines.push(`- Checked at: ${report.checkedAt}`);
  lines.push('');
  if (report.issues.length > 0) {
    lines.push('| Check | Severity | Fixture | Message |');
    lines.push('|---|---|---|---|');
    for (const issue of report.issues) {
      lines.push(`| ${issue.check} | ${issue.severity} | ${issue.fixtureId ?? '—'} | ${issue.message} |`);
    }
  } else {
    lines.push('_No integrity issues detected._');
  }
  lines.push('');
  return lines.join('\n');
}

export function integrityReportCSV(report: IntegrityReport): string {
  const rows: string[] = ['check,severity,fixtureId,message'];
  for (const issue of report.issues) {
    const message = issue.message.replace(/"/g, '""');
    rows.push(`${issue.check},${issue.severity},${issue.fixtureId ?? ''},"${message}"`);
  }
  return rows.join('\n');
}

// ─── Coverage Report ─────────────────────────────────────────────────────

function coverageRow(l: LeagueCoverageSummary): string {
  return `| ${l.leagueId} | ${pct(l.fixtures)} | ${pct(l.odds)} | ${pct(l.closingOdds)} | ${pct(l.moneyline)} | ${pct(l.asianHandicap)} | ${pct(l.overUnder)} | ${pct(l.xg)} | ${pct(l.lineups)} | ${pct(l.injuries)} | ${pct(l.weather)} | ${l.overallPct.toFixed(1)}% |`;
}

export function coverageReportMarkdown(report: CoverageReport): string {
  const lines: string[] = [];
  lines.push(`# Coverage Report — ${report.datasetId}`);
  lines.push('');
  lines.push(`**Overall coverage:** ${report.overallPct.toFixed(1)}%`);
  lines.push('');
  lines.push('| League | Fixtures | Odds | Closing | ML | AH | OU | xG | Lineups | Injuries | Weather | Overall |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const l of report.leagues) lines.push(coverageRow(l));
  lines.push('');
  return lines.join('\n');
}

export function coverageReportCSV(report: CoverageReport): string {
  const rows: string[] = [
    'league,season,fixtures,odds,closingOdds,moneyline,asianHandicap,overUnder,xg,lineups,injuries,weather,overall',
  ];
  for (const l of report.leagues) {
    rows.push([
      l.leagueId,
      l.seasonId,
      l.fixtures.pct,
      l.odds.pct,
      l.closingOdds.pct,
      l.moneyline.pct,
      l.asianHandicap.pct,
      l.overUnder.pct,
      l.xg.pct,
      l.lineups.pct,
      l.injuries.pct,
      l.weather.pct,
      l.overallPct,
    ].join(','));
  }
  return rows.join('\n');
}

// ─── Validation Report ─────────────────────────────────────────────────────

export function validationReportMarkdown(report: DatasetValidationReport): string {
  const lines: string[] = [];
  lines.push(`# Validation Report — ${report.datasetId}`);
  lines.push('');
  lines.push(`**Valid:** ${report.valid ? '✅' : '❌'}`);
  lines.push('');
  lines.push(`- Total fixtures: ${report.totalFixtures}`);
  lines.push(`- Valid fixtures: ${report.validFixtures}`);
  lines.push(`- Invalid fixtures: ${report.invalidFixtures}`);
  lines.push(`- Duplicate fixtures: ${report.duplicateFixtures}`);
  lines.push(`- Missing results: ${report.missingResults}`);
  lines.push(`- Missing odds: ${report.missingOdds}`);
  lines.push('');
  if (report.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    lines.push('| Fixture | Field | Message |');
    lines.push('|---|---|---|');
    for (const e of report.errors) lines.push(`| ${e.fixtureId} | ${e.field} | ${e.message} |`);
    lines.push('');
  }
  return lines.join('\n');
}
