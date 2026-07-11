/**
 * EPIC 18.9 — Reliability Reporting
 */

import type { ReliabilityReport } from './types';
import { generatePIReportId } from './id';

export class ReliabilityReportGenerator {
  generate(params: {
    datasetId: string;
    calibratorId: string;
    market: string;
    reliabilityCurve: any;
    metrics: any;
  }): ReliabilityReport {
    return {
      reportId: generatePIReportId(),
      generatedAt: new Date().toISOString(),
      datasetId: params.datasetId,
      calibratorId: params.calibratorId as any,
      market: params.market,
      reliabilityCurve: params.reliabilityCurve,
      metrics: params.metrics,
      crossValidation: null,
      drift: null,
      comparisonResults: [],
    };
  }

  toMarkdown(report: ReliabilityReport): string {
    const lines: string[] = [];
    lines.push(`# Reliability Report — ${report.reportId}`);
    lines.push('');
    lines.push(`**Dataset:** ${report.datasetId}`);
    lines.push(`**Calibrator:** ${report.calibratorId}`);
    lines.push(`**Market:** ${report.market}`);
    lines.push('');
    lines.push('## Calibration Metrics');
    lines.push(`- ECE: ${report.metrics.ece}`);
    lines.push(`- MCE: ${report.metrics.mce}`);
    lines.push(`- Brier Score: ${report.metrics.brierScore}`);
    lines.push(`- Log Loss: ${report.metrics.logLoss}`);
    lines.push('');
    lines.push('## Reliability Curve');
    lines.push('| Bucket | Expected | Observed | Residual | Count |');
    lines.push('|---|---|---|---|---|');
    for (const b of report.reliabilityCurve.buckets) {
      lines.push(`| ${b.binLower.toFixed(1)}-${b.binUpper.toFixed(1)} | ${(b.expectedFrequency * 100).toFixed(1)}% | ${(b.observedFrequency * 100).toFixed(1)}% | ${(b.residual * 100).toFixed(1)}% | ${b.count} |`);
    }
    lines.push('');
    lines.push(`_Generated: ${report.generatedAt}_`);
    return lines.join('\n');
  }

  toJSON(report: ReliabilityReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const defaultReliabilityReportGenerator = new ReliabilityReportGenerator();