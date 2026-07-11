/**
 * EPIC 18.12 — Champion Calibration Gate
 * A model cannot become Champion unless calibration requirements pass.
 */

import type { CalibrationGateCriteria, CalibrationGateResult, ChampionCalibrationDecision, CalibrationMetricsResult, DriftReport } from './types';
import { generateCalGateId } from './id';

export class ChampionCalibrationGate {
  evaluate(
    candidateBaselineId: string,
    metrics: CalibrationMetricsResult,
    criteria: CalibrationGateCriteria,
    extra?: { drift?: DriftReport }
  ): ChampionCalibrationDecision {
    const gates: CalibrationGateResult[] = [];

    gates.push({
      gate: 'Maximum ECE',
      passed: metrics.ece <= criteria.maxEce,
      value: metrics.ece,
      threshold: criteria.maxEce,
      detail: `ECE ${metrics.ece} <= ${criteria.maxEce}`,
    });

    gates.push({
      gate: 'Maximum MCE',
      passed: metrics.mce <= criteria.maxMce,
      value: metrics.mce,
      threshold: criteria.maxMce,
      detail: `MCE ${metrics.mce} <= ${criteria.maxMce}`,
    });

    gates.push({
      gate: 'Minimum Sharpness',
      passed: metrics.sharpness >= criteria.minSharpness,
      value: metrics.sharpness,
      threshold: criteria.minSharpness,
      detail: `Sharpness ${metrics.sharpness} >= ${criteria.minSharpness}`,
    });

    gates.push({
      gate: 'Maximum Log Loss',
      passed: metrics.logLoss <= criteria.maxLogLoss,
      value: metrics.logLoss,
      threshold: criteria.maxLogLoss,
      detail: `Log Loss ${metrics.logLoss} <= ${criteria.maxLogLoss}`,
    });

    if (extra?.drift) {
      gates.push({
        gate: 'Calibration Drift',
        passed: (extra.drift.results[0]?.pstabilityIndex ?? 0) <= criteria.maxCalibrationDrift,
        value: extra.drift.results[0]?.pstabilityIndex ?? 0,
        threshold: criteria.maxCalibrationDrift,
        detail: `PSI ${(extra.drift.results[0]?.pstabilityIndex ?? 0).toFixed(4)} <= ${criteria.maxCalibrationDrift}`,
      });

      gates.push({
        gate: 'Probability Drift',
        passed: (extra.drift.results[0]?.earthMoverDistance ?? 0) <= criteria.maxProbabilityDrift,
        value: extra.drift.results[0]?.earthMoverDistance ?? 0,
        threshold: criteria.maxProbabilityDrift,
        detail: `EMD ${(extra.drift.results[0]?.earthMoverDistance ?? 0).toFixed(4)} <= ${criteria.maxProbabilityDrift}`,
      });
    }

    const allPassed = gates.every((g) => g.passed);
    const passedCount = gates.filter((g) => g.passed).length;

    return {
      decisionId: generateCalGateId(),
      candidateBaselineId,
      criteria,
      gates,
      passed: allPassed,
      decisionReport: allPassed
        ? `✅ Calibration gate PASSED (${passedCount}/${gates.length})`
        : `❌ Calibration gate FAILED (${passedCount}/${gates.length})`,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultChampionCalibrationGate = new ChampionCalibrationGate();