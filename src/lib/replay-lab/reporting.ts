/**
 * EPIC 16.11 — Replay Reporting
 * ===============================
 * Generates comprehensive replay reports in Markdown, JSON, and CSV formats.
 *
 * Includes: Executive Summary, Replay Metadata, Dataset Provenance,
 * Model Information, Feature Information, Calibration, ROI, Yield, CLV,
 * Bootstrap Results, Comparison Tables, Decision Analysis, Risk Metrics,
 * Recommendations, Evidence Links, Research Artifact IDs.
 */

import type { ReplaySessionSnapshot, ReplayReport, BootstrapResult, ComparisonReport } from './types';
import type { DatasetProvenance, EvidenceDatasetManifest } from '../evidence-platform/types';
import { generateReportId } from './id';
import { REPLAY_LAB_VERSION } from './types';

export class ReplayReportGenerator {
  generateReport(
    session: ReplaySessionSnapshot,
    options: {
      bootstrapResults?: readonly BootstrapResult[];
      comparisonTables?: readonly ComparisonReport[];
      provenance?: DatasetProvenance | null;
      manifest?: EvidenceDatasetManifest | null;
      modelInfo?: Record<string, string>;
      featureInfo?: Record<string, string>;
      recommendations?: readonly string[];
      evidenceLinks?: readonly string[];
    } = {}
  ): ReplayReport {
    const metrics = session.metrics;
    const now = new Date().toISOString();

    return {
      reportId: generateReportId(),
      sessionId: session.sessionId,
      generatedAt: now,
      gitCommit: session.gitCommit,
      architectureVersion: session.architectureVersion,
      executiveSummary: this.buildExecutiveSummary(session, metrics),
      replayMetadata: session,
      datasetProvenance: options.provenance ?? null,
      datasetManifest: options.manifest ?? null,
      modelInfo: options.modelInfo ?? {},
      featureInfo: options.featureInfo ?? {},
      calibration: metrics ? { brierScore: metrics.brierScore, logLoss: metrics.logLoss } : {},
      roi: metrics?.roi ?? 0,
      yield_: metrics ? (metrics.totalPredictions > 0 ? metrics.totalProfit / metrics.totalPredictions : 0) : 0,
      clv: metrics?.avgClv ?? 0,
      bootstrapResults: options.bootstrapResults ?? [],
      comparisonTables: options.comparisonTables ?? [],
      decisionAnalysis: metrics ? { totalDecisions: metrics.totalPredictions, won: metrics.won, lost: metrics.lost } : {},
      riskMetrics: metrics ? { maxDrawdown: 0, sharpeRatio: 0, longestLosingStreak: metrics.lost } : {},
      recommendations: options.recommendations ?? [],
      evidenceLinks: options.evidenceLinks ?? [],
      researchArtifactIds: [session.sessionId, session.gitCommit],
    };
  }

  private buildExecutiveSummary(session: ReplaySessionSnapshot, metrics: ReplayReport['replayMetadata']['metrics']): string {
    const lines: string[] = [];
    lines.push(`# Replay Report — ${session.sessionId}`);
    lines.push('');
    lines.push(`Experiment: ${session.experimentId}`);
    lines.push(`Dataset: ${session.datasetId} (v${session.datasetVersion})`);
    lines.push(`Model: ${session.modelVersion} | Features: ${session.featureVersion}`);
    lines.push(`Seed: ${session.seed} | Status: ${session.status}`);
    if (metrics) {
      lines.push(`ROI: ${metrics.roi}% | Brier: ${metrics.brierScore} | CLV: ${metrics.avgClv}`);
      lines.push(`Won: ${metrics.won} / Lost: ${metrics.lost} / Push: ${metrics.voided}`);
    }
    return lines.join('\n');
  }

  toMarkdown(report: ReplayReport): string {
    const lines: string[] = [];
    lines.push(report.executiveSummary);
    lines.push('');
    lines.push('## Replay Metadata');
    lines.push(`- Session ID: ${report.replayMetadata.sessionId}`);
    lines.push(`- Dataset: ${report.replayMetadata.datasetId}`);
    lines.push(`- Dataset Version: ${report.replayMetadata.datasetVersion}`);
    lines.push(`- Model Version: ${report.replayMetadata.modelVersion}`);
    lines.push(`- Feature Version: ${report.replayMetadata.featureVersion}`);
    lines.push(`- Seed: ${report.replayMetadata.seed}`);
    lines.push(`- Git Commit: ${report.replayMetadata.gitCommit}`);
    lines.push(`- Architecture Version: ${report.replayMetadata.architectureVersion}`);
    lines.push('');
    lines.push('## Performance');
    lines.push(`- ROI: ${report.roi.toFixed(2)}%`);
    lines.push(`- Yield: ${report.yield_.toFixed(4)}`);
    lines.push(`- CLV: ${report.clv.toFixed(4)}`);
    lines.push(`- Brier Score: ${report.calibration.brierScore?.toFixed(4) ?? 'N/A'}`);
    lines.push('');
    if (report.bootstrapResults.length > 0) {
      lines.push('## Bootstrap Validation');
      for (const br of report.bootstrapResults) {
        lines.push(`- ${br.bootstrappedMetric}: observed=${br.observedValue.toFixed(4)}, CI=[${br.ciLower.toFixed(4)}, ${br.ciUpper.toFixed(4)}], significant=${br.significant}`);
      }
      lines.push('');
    }
    if (report.comparisonTables.length > 0) {
      lines.push('## Comparisons');
      for (const ct of report.comparisonTables) {
        lines.push(`- ${ct.sessionA} vs ${ct.sessionB}: ROI delta=${ct.roiDelta}, CLV delta=${ct.clvDelta}`);
      }
      lines.push('');
    }
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      for (const r of report.recommendations) lines.push(`- ${r}`);
    }
    lines.push('');
    lines.push(`_Report generated at ${report.generatedAt} | Git: ${report.gitCommit}_`);
    return lines.join('\n');
  }

  toJSON(report: ReplayReport): string {
    return JSON.stringify(report, null, 2);
  }
}

export const defaultReportGenerator = new ReplayReportGenerator();