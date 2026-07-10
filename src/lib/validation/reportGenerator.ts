/**
 * HandicapLab Validation Report Generator
 * ==========================================
 * Generates markdown and JSON validation reports.
 *
 * All functions are pure — no side effects.
 * No production code is modified.
 */

import { ValidationMetrics } from './metrics';
import { CalibrationReport } from './calibration';

export interface BootstrapResult {
  mean: number;
  standardError: number;
  confidenceInterval95: [number, number];
  confidenceInterval99: [number, number];
  distribution: number[];
}

export interface WalkForwardWindowResult {
  startIndex: number;
  endIndex: number;
  metrics: ValidationMetrics;
}

export interface WalkForwardResult {
  windows: WalkForwardWindowResult[];
  overallMetrics: ValidationMetrics;
  rollingRoi: number[];
  rollingBrier: number[];
  rollingWinRate: number[];
}

export class ValidationReportGenerator {
  generateMarkdown(
    metrics: ValidationMetrics,
    calibration: CalibrationReport,
    bootstrap: BootstrapResult,
    walkForward: WalkForwardResult,
    leagueResults: Record<string, ValidationMetrics>
  ): string {
    const lines: string[] = [];
    const ts = new Date().toISOString();

    lines.push(`# Validation Report\n`);
    lines.push(`**Generated:** ${ts}\n`);

    lines.push(`## Summary\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| ROI | ${metrics.roi.toFixed(2)}% |`);
    lines.push(`| Yield | ${metrics.yield_.toFixed(2)}% |`);
    lines.push(`| Win Rate | ${metrics.winRate.toFixed(2)}% |`);
    lines.push(`| Total Bets | ${metrics.totalBets} |`);
    lines.push(`| Won | ${metrics.won} |`);
    lines.push(`| Lost | ${metrics.lost} |`);
    lines.push(`| Brier Score | ${metrics.brierScore.toFixed(4)} |`);
    lines.push(`| Log Loss | ${metrics.logLoss.toFixed(4)} |`);
    lines.push(`| Expected Value | ${metrics.expectedValue.toFixed(4)} |`);
    lines.push(`| Avg CLV | ${metrics.avgClv.toFixed(4)} |`);
    lines.push(`| Kelly Growth | ${metrics.kellyGrowth.toFixed(4)} |`);
    lines.push(`| Sharpe Ratio | ${metrics.sharpeRatio.toFixed(4)} |`);
    lines.push(`| Variance | ${metrics.variance.toFixed(4)} |`);
    lines.push(`| Std Dev | ${metrics.standardDeviation.toFixed(4)} |`);
    lines.push(``);

    lines.push(`## Calibration\n`);
    lines.push(`| ECE | MCE | Sharpness |`);
    lines.push(`|-----|-----|-----------|`);
    lines.push(`| ${calibration.ece.toFixed(4)} | ${calibration.mce.toFixed(4)} | ${calibration.sharpness.toFixed(4)} |`);
    lines.push(``);
    lines.push(`### Reliability Bins\n`);
    lines.push(`| Bin Range | Count | Mean Predicted | Mean Observed | Diff |`);
    lines.push(`|-----------|-------|----------------|---------------|------|`);
    for (const bin of calibration.bins) {
      if (bin.count > 0) {
        const diff = Math.abs((bin.meanPredicted - bin.meanObserved) * 100).toFixed(2);
        lines.push(`| ${bin.binStart.toFixed(1)}-${bin.binEnd.toFixed(1)} | ${bin.count} | ${(bin.meanPredicted * 100).toFixed(1)}% | ${(bin.meanObserved * 100).toFixed(1)}% | ${diff}% |`);
      }
    }
    lines.push(``);

    lines.push(`## Bootstrap (${bootstrap.distribution.length} samples)\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Mean | ${(bootstrap.mean * 100).toFixed(2)}% |`);
    lines.push(`| Std Error | ${(bootstrap.standardError * 100).toFixed(4)}% |`);
    lines.push(`| 95% CI | [${(bootstrap.confidenceInterval95[0] * 100).toFixed(2)}%, ${(bootstrap.confidenceInterval95[1] * 100).toFixed(2)}%] |`);
    lines.push(`| 99% CI | [${(bootstrap.confidenceInterval99[0] * 100).toFixed(2)}%, ${(bootstrap.confidenceInterval99[1] * 100).toFixed(2)}%] |`);
    lines.push(``);

    lines.push(`## Walk Forward (${walkForward.windows.length} windows)\n`);
    lines.push(`| Window | ROI | Brier | Win Rate |`);
    lines.push(`|--------|-----|------|---------|`);
    for (let i = 0; i < walkForward.windows.length; i++) {
      const w = walkForward.windows[i];
      lines.push(`| ${i + 1} | ${w.metrics.roi.toFixed(2)}% | ${w.metrics.brierScore.toFixed(4)} | ${w.metrics.winRate.toFixed(2)}% |`);
    }
    lines.push(``);

    lines.push(`## League Comparison\n`);
    const sorted = Object.entries(leagueResults).sort(([, a], [, b]) => b.roi - a.roi);
    if (sorted.length > 0) {
      lines.push(`| League | ROI | Win Rate | Brier | Bets |`);
      lines.push(`|--------|-----|---------|------|------|`);
      for (const [league, lm] of sorted) {
        lines.push(`| ${league} | ${lm.roi.toFixed(2)}% | ${lm.winRate.toFixed(2)}% | ${lm.brierScore.toFixed(4)} | ${lm.totalBets} |`);
      }
    }

    return lines.join('\n');
  }

  generateJson(
    metrics: ValidationMetrics,
    calibration: CalibrationReport,
    bootstrap: BootstrapResult,
    walkForward: WalkForwardResult,
    leagueResults: Record<string, ValidationMetrics>
  ): object {
    return {
      timestamp: new Date().toISOString(),
      summary: metrics,
      calibration,
      bootstrap,
      walkForward: {
        windowCount: walkForward.windows.length,
        overallMetrics: walkForward.overallMetrics,
        rollingRoi: walkForward.rollingRoi,
        rollingBrier: walkForward.rollingBrier,
        rollingWinRate: walkForward.rollingWinRate,
      },
      leagueComparison: Object.fromEntries(
        Object.entries(leagueResults).map(([league, lm]) => [league, lm])
      ),
    };
  }
}