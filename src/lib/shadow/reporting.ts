/**
 * 21.11 — Research Reporting
 * Daily, weekly, monthly, research, executive, model, decision, calibration, CLV, portfolio reports.
 */

import type { ShadowReport, ShadowReportType, DashboardMetrics } from './types';
import { generateSHReportId } from './id';

export class ShadowReportGenerator {
  generate(params: { type: ShadowReportType; summary: string; metrics: DashboardMetrics; data: unknown }): ShadowReport {
    return { reportId: generateSHReportId(), generatedAt: new Date().toISOString(), type: params.type, summary: params.summary, metrics: params.metrics, data: params.data };
  }

  toMarkdown(report: ShadowReport): string {
    const lines: string[] = [];
    lines.push(`# ${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Shadow Research Report`);
    lines.push('');
    lines.push(report.summary);
    lines.push('');
    lines.push('## Performance');
    lines.push(`- Total Predictions: ${report.metrics.totalPredictions}`);
    lines.push(`- ROI: ${report.metrics.roi}%`);
    lines.push(`- Yield: ${report.metrics.yield_}`);
    lines.push(`- CLV: ${report.metrics.clv}`);
    lines.push(`- Win Rate: ${report.metrics.winRate}%`);
    lines.push(`- Sharpe Ratio: ${report.metrics.sharpeRatio}`);
    lines.push(`- Max Drawdown: ${report.metrics.maxDrawdown}%`);
    lines.push('');
    lines.push(`_Report: ${report.reportId} | Generated: ${report.generatedAt}_`);
    return lines.join('\n');
  }

  toJSON(report: ShadowReport): string { return JSON.stringify(report, null, 2); }
}

export const defaultShadowReportGenerator = new ShadowReportGenerator();