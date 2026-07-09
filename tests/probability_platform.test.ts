import { describe, it, expect } from 'vitest';
import { ProbabilityContract } from '../src/lib/probability/ProbabilityContract';
import { AcceptanceGate } from '../src/lib/calibration/AcceptanceGate';
import { CalibrationRegistry, CalibrationRegistryEntry } from '../src/lib/calibration/CalibrationRegistry';
import { runCalibrationBenchmark } from '../src/pipelines/benchmark';
import { OODDetector } from '../src/lib/ood/OODDetector';
import { ConfidenceCalculator } from '../src/lib/confidence/ConfidenceCalculator';

describe('Probability Platform (Phase B)', () => {
  it('should validate ProbabilityObject contract', () => {
    const rawObj = {
      probability_version: 'v1',
      raw_probability: 0.75,
      risk_flags: ['high_variance']
    };
    const probObj = ProbabilityContract.validate(rawObj);
    expect(probObj.raw_probability).toBe(0.75);
    expect(probObj.probability_version).toBe('v1');
  });

  it('should compute OOD score and confidence', () => {
    const ood = OODDetector.computeOODScore([1.2, 0.5, 3]);
    expect(ood).toBeGreaterThan(0.9);

    const confidence = ConfidenceCalculator.calculate(1.0, 1.0, 1.0, ood, 1.0);
    expect(confidence).toBeCloseTo(ood);
  });

  it('should run benchmark pipeline and select champion', async () => {
    const result = await runCalibrationBenchmark('test_dataset', []);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.champion).not.toBeNull();
  });

  it('should reject worsened calibration via Acceptance Gate', () => {
    const baseline: CalibrationRegistryEntry = {
      method: 'Raw',
      dataset: 'test',
      protocol: 'v1',
      ece: 0.05,
      brier: 0.20,
      log_loss: 0.60,
      champion: true
    };

    const badCandidate: CalibrationRegistryEntry = {
      method: 'BadCalibrator',
      dataset: 'test',
      protocol: 'v1',
      ece: 0.10, // Worse
      brier: 0.25,
      log_loss: 0.70,
      champion: false
    };


    const evaluation = AcceptanceGate.evaluate(badCandidate, baseline);
    expect(evaluation.approved).toBe(false);
    expect(evaluation.reason).toContain('ECE worsened');
  });
});
