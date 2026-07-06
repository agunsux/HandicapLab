// Drift Detector Unit Tests
// Location: tests/drift-detector.test.ts

import { describe, it, expect } from 'vitest';
import { DriftDetector } from '../src/lib/engine/drift-detector';

describe('DriftDetector', () => {
  it('should compute PSI for stable distribution', () => {
    const expected = [1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1];
    const actual = [1.2, 1.3, 1.49, 1.6, 1.71, 1.8, 1.9, 2.0, 2.1];

    const report = DriftDetector.calculatePSI(expected, actual);
    expect(report.psi).toBeLessThan(0.1);
    expect(report.status).toBe('STABLE');
  });

  it('should compute PSI for drifted distribution', () => {
    const expected = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    const actual = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5];

    const report = DriftDetector.calculatePSI(expected, actual);
    expect(report.psi).toBeGreaterThan(0.25);
    expect(report.status).toBe('ACTION_REQUIRED');
  });

  it('should detect concept drift when ECE exceeds thresholds', () => {
    const check = DriftDetector.checkConceptDrift(
      0.16, // current ECE
      0.05, // baseline ECE
      0.02, // std dev ece
      0.15, // current brier
      0.14, // baseline brier
      0.01  // std dev brier
    );
    expect(check.drifted).toBe(true);
    expect(check.reason).toContain('ECE');
  });
});
