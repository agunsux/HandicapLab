// Drift Detection Engine
// Location: src/lib/engine/drift-detector.ts

export interface DriftReport {
  psi: number;
  status: 'STABLE' | 'WARNING' | 'ACTION_REQUIRED';
}

export class DriftDetector {
  /**
   * Computes the Population Stability Index (PSI) to detect data distribution drift.
   * PSI = sum( (Actual_i - Expected_i) * ln(Actual_i / Expected_i) )
   *
   * Thresholds:
   * - PSI < 0.1: No significant change (STABLE)
   * - 0.1 <= PSI < 0.25: Slight change (WARNING)
   * - PSI >= 0.25: Significant change (ACTION_REQUIRED)
   */
  public static calculatePSI(
    expected: number[],
    actual: number[],
    numBins = 10
  ): DriftReport {
    if (expected.length === 0 || actual.length === 0) {
      return { psi: 0.0, status: 'STABLE' };
    }

    // Determine min and max to define bin bounds
    const combined = [...expected, ...actual];
    const min = Math.min(...combined);
    const max = Math.max(...combined);
    const range = max - min;
    const binSize = range === 0 ? 1.0 : range / numBins;

    const expectedCounts = new Array(numBins).fill(0);
    const actualCounts = new Array(numBins).fill(0);

    // Bin the expected data
    for (const val of expected) {
      const idx = range === 0 ? 0 : Math.min(numBins - 1, Math.floor((val - min) / binSize));
      expectedCounts[idx]++;
    }

    // Bin the actual data
    for (const val of actual) {
      const idx = range === 0 ? 0 : Math.min(numBins - 1, Math.floor((val - min) / binSize));
      actualCounts[idx]++;
    }

    let psi = 0.0;
    const nExp = expected.length;
    const nAct = actual.length;

    for (let i = 0; i < numBins; i++) {
      // Use Laplace smoothing (add small constant to avoid division by zero or log(0))
      const expPct = (expectedCounts[i] + 0.5) / (nExp + 0.5 * numBins);
      const actPct = (actualCounts[i] + 0.5) / (nAct + 0.5 * numBins);

      psi += (actPct - expPct) * Math.log(actPct / expPct);
    }

    let status: 'STABLE' | 'WARNING' | 'ACTION_REQUIRED' = 'STABLE';
    if (psi >= 0.25) {
      status = 'ACTION_REQUIRED';
    } else if (psi >= 0.1) {
      status = 'WARNING';
    }

    return {
      psi: Number(psi.toFixed(6)),
      status
    };
  }

  /**
   * Detects concept drift based on validation metrics.
   * If current ECE or Brier scores exceed baseline + stdDev bounds, drift is flagged.
   */
  public static checkConceptDrift(
    currentECE: number,
    baselineECE: number,
    eceStdDev: number,
    currentBrier: number,
    baselineBrier: number,
    brierStdDev: number
  ): { drifted: boolean; reason?: string } {
    const eceLimit = baselineECE + 2.0 * eceStdDev;
    const brierLimit = baselineBrier + 2.0 * brierStdDev;

    if (currentECE > eceLimit) {
      return {
        drifted: true,
        reason: `ECE of ${currentECE.toFixed(4)} exceeded drift threshold of ${eceLimit.toFixed(4)} (Baseline: ${baselineECE.toFixed(4)}, StdDev: ${eceStdDev.toFixed(4)})`
      };
    }

    if (currentBrier > brierLimit) {
      return {
        drifted: true,
        reason: `Brier score of ${currentBrier.toFixed(4)} exceeded drift threshold of ${brierLimit.toFixed(4)} (Baseline: ${baselineBrier.toFixed(4)}, StdDev: ${brierStdDev.toFixed(4)})`
      };
    }

    return { drifted: false };
  }
}
