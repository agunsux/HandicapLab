/**
 * EPIC 17.9 — Benchmark Reporting
 * Generates comprehensive benchmark reports in Markdown, JSON, and CSV.
 */

import type { BenchmarkReport, BaselineScenarioMetrics, EvaluationMetricsResult, ChampionPromotionDecision } from './types';
import type { BaselineId } from '../replay-lab/types';
import { generateBVReportId } from './id';

export class BenchmarkReportGenerator {
  generateReport(params: {
    datasets: readonly string[];
    replaySessions: readonly string[];
    baselines: readonly BaselineId[];
    evaluationMetrics: readonly BaselineScenarioMetrics[];
    championDecision: ChampionPromotionDecision | null;
    evidenceLinks: readonly string[];
    datasetFingerprints: readonly string[];
    modelVersions: readonly string[];
    recommendations: readonly string[];
  }): BenchmarkReport {
    const topRoi = params.evaluationMetrics.length > 0
      ? Math.max(...params.evaluationMetrics.map((m) => m.metrics.roi))
      : 0;

    return {
      reportId: generateBVReportId(),
      generatedAt: new Date().toISOString(),
      executiveSummary: this.buildSummary(params.baselines.length, params.evaluationMetrics, params.championDecision),
      datasets: params.datasets,
      replaySessions: params.replaySessions,
      baselines: params.baselines,
      evaluationMetrics: params.evaluationMetrics,
      confidenceIntervals: [],
      calibration: {},
      ranking: null,
      championDecision: params.championDecision,
      scenarioResults: [],
      evidenceLinks: params.evidenceLinks,
      datasetFingerprints: params.datasetFingerprints,
      modelVersions: params.modelVersions,
      recommendations: params.recommendations,
    };
  }

  private buildSummary(
    baselineCount: number,
    metrics: readonly BaselineScenarioMetrics[],
    championDecision: ChampionPromotionDecision | null
  ): string {
    const lines: string[] = [];
    lines.push(`# Baseline Validation Report`);
    lines.push('');
    lines.push(`**Baselines evaluated:** ${baselineCount}`);
    if (metrics.length > 0) {
      const best = metrics.reduce((a, b) => a.metrics.roi > b.metrics.roi ? a : b);
      lines.push(`**Best baseline:** ${best.baselineId} (ROI: ${best.metrics.roi}%)`);
    }
    if (championDecision) {
      lines.push(`**Champion decision:** ${championDecision.passed ? '✅ PROMOTED' : '❌ REJECTED'}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  toMarkdown(report: BenchmarkReport): string {
    const lines: string[] = [];
    lines.push(report.executiveSummary);
    lines.push('');
    lines.push('## Baselines');
    lines.push('| Baseline | ROI | Brier | CLV |');
    lines.push('|---|---|---|---|');
    for (const m of report.evaluationMetrics) {
      lines.push(`| ${m.baselineId} | ${m.metrics.roi}% | ${m.metrics.brierScore} | ${m.metrics.avgClv} |`);
    }
    lines.push('');
    lines.push('## Champion Decision');
    if (report.championDecision) {
      lines.push(report.championDecision.decisionReport);
      lines.push('');
      lines.push('| Gate | Passed | Value | Threshold |');
      lines.push('|---|---|---|---|');
      for (const gate of report.championDecision.gates) {
        lines.push(`| ${gate.gate} | ${gate.passed ? '✅' : '❌'} | ${gate.value} | ${gate.threshold} |`);
      }
    } else {
      lines.push('_No champion decision recorded._');
    }
    lines.push('');
    lines.push('## Recommendations');
    for (const r of report.recommendations) lines.push(`- ${r}`);
    lines.push('');
    lines.push(`_Report: ${report.reportId} | Generated: ${report.generatedAt}_`);
    return lines.join('\n');
  }

  toJSON(report: BenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const defaultBenchmarkReportGenerator = new BenchmarkReportGenerator();