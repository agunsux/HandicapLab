/**
 * EPIC 19.11 — Feature Reporting
 * Generates Feature Catalog, Importance, Ablation, Drift, Redundancy, Governance, Quality reports.
 */

import type { FeatureReport } from './types';
import { generateFIReportId } from './id';

export class FeatureReportGenerator {
  generate(params: {
    type: FeatureReport['type'];
    summary: string;
    data: unknown;
  }): FeatureReport {
    return {
      reportId: generateFIReportId(),
      generatedAt: new Date().toISOString(),
      type: params.type,
      summary: params.summary,
      data: params.data,
    };
  }

  toMarkdown(report: FeatureReport): string {
    const lines: string[] = [];
    lines.push(`# ${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report`);
    lines.push('');
    lines.push(report.summary);
    lines.push('');
    lines.push(`_Report: ${report.reportId} | Type: ${report.type}_`);
    lines.push(`_Generated: ${report.generatedAt}_`);
    return lines.join('\n');
  }

  toJSON(report: FeatureReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const defaultFeatureReportGenerator = new FeatureReportGenerator();