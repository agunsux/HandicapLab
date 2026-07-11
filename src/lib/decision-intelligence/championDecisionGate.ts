/**
 * EPIC 20.12 — Champion Decision Gate
 * A model may only become production-ready if all gates pass.
 */

import type { ChampionDecisionCriteria, ChampionDecisionGateResult, ChampionDecisionGateDecision } from './types';
import { generateGateId } from './id';

export class ChampionDecisionGate {
  evaluate(
    candidateBaselineId: string,
    criteria: ChampionDecisionCriteria,
    extra?: { meanExpectedValue?: number; consistencyScore?: number; stakeStabilityScore?: number; portfolioRisk?: number; calibrationPassed?: boolean; featureValidated?: boolean; replayValidated?: boolean; baselineComparisonPassed?: boolean }
  ): ChampionDecisionGateDecision {
    const gates: ChampionDecisionGateResult[] = [];

    gates.push({ gate: 'Expected Value Threshold', passed: (extra?.meanExpectedValue ?? 0) >= criteria.minExpectedValue, value: extra?.meanExpectedValue ?? 0, threshold: criteria.minExpectedValue, detail: `Mean EV ${(extra?.meanExpectedValue ?? 0).toFixed(4)} >= ${criteria.minExpectedValue}` });
    gates.push({ gate: 'Decision Consistency', passed: (extra?.consistencyScore ?? 0) >= criteria.minDecisionConsistency, value: extra?.consistencyScore ?? 0, threshold: criteria.minDecisionConsistency, detail: `Consistency ${extra?.consistencyScore ?? 0} >= ${criteria.minDecisionConsistency}` });
    gates.push({ gate: 'Stake Stability', passed: (extra?.stakeStabilityScore ?? 0) >= criteria.minStakeStability, value: extra?.stakeStabilityScore ?? 0, threshold: criteria.minStakeStability, detail: `Stake stability ${extra?.stakeStabilityScore ?? 0} >= ${criteria.minStakeStability}` });
    gates.push({ gate: 'Portfolio Risk', passed: (extra?.portfolioRisk ?? 0) <= criteria.maxPortfolioRisk, value: extra?.portfolioRisk ?? 0, threshold: criteria.maxPortfolioRisk, detail: `Portfolio risk ${extra?.portfolioRisk ?? 0} <= ${criteria.maxPortfolioRisk}` });

    if (criteria.requireCalibrationPass) gates.push({ gate: 'Calibration Pass', passed: extra?.calibrationPassed ?? false, value: extra?.calibrationPassed ? 1 : 0, threshold: 1, detail: 'Calibration validation required' });
    if (criteria.requireFeatureValidation) gates.push({ gate: 'Feature Validation', passed: extra?.featureValidated ?? false, value: extra?.featureValidated ? 1 : 0, threshold: 1, detail: 'Feature validation required' });
    if (criteria.requireReplayValidation) gates.push({ gate: 'Replay Validation', passed: extra?.replayValidated ?? false, value: extra?.replayValidated ? 1 : 0, threshold: 1, detail: 'Replay validation required' });
    if (criteria.requireBaselineComparison) gates.push({ gate: 'Baseline Comparison', passed: extra?.baselineComparisonPassed ?? false, value: extra?.baselineComparisonPassed ? 1 : 0, threshold: 1, detail: 'Baseline comparison required' });

    const allPassed = gates.every((g) => g.passed);
    return {
      decisionId: generateGateId(),
      candidateBaselineId,
      criteria,
      gates,
      passed: allPassed,
      decisionReport: allPassed ? `✅ Champion decision gate PASSED (${gates.filter((g) => g.passed).length}/${gates.length})` : `❌ Champion decision gate FAILED (${gates.filter((g) => g.passed).length}/${gates.length})`,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultChampionDecisionGate = new ChampionDecisionGate();