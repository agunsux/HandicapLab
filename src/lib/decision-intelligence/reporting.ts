/**
 * EPIC 20.11 — Decision Reporting
 */

import type { DecisionReport } from './types';
import { generateDIReportId } from './id';

export class DecisionReportGenerator {
  generate(params: { type: DecisionReport['type']; summary: string; data: unknown }): DecisionReport {
    return { reportId: generateDIReportId(), generatedAt: new Date().toISOString(), type: params.type, summary: params.summary, data: params.data };
  }

  toMarkdown(report: DecisionReport): string {
    return `# Decision Report\n\n${report.summary}\n\n_Report: ${report.reportId} | Type: ${report.type}_\n_Generated: ${report.generatedAt}_`;
  }

  toJSON(report: DecisionReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const defaultDecisionReportGenerator = new DecisionReportGenerator();