import type { ReplayOutcome } from '../../lib/epic31b/types';

export interface DriftReport {
  psi: number;
  klDivergence: number;
  jsDivergence: number;
  driftStatus: 'STABLE' | 'WARNING' | 'DRIFT_DETECTED';
}

export class DriftDetector {
  /**
   * Calculates the Population Stability Index (PSI) and Divergence metrics
   * between two splits of match outcomes (baseline vs target).
   */
  public static calculateDrift(outcomes: ReplayOutcome[]): DriftReport {
    if (outcomes.length < 20) {
      return { psi: 0, klDivergence: 0, jsDivergence: 0, driftStatus: 'STABLE' };
    }

    const mid = Math.floor(outcomes.length / 2);
    const base = outcomes.slice(0, mid);
    const target = outcomes.slice(mid);

    const binCount = 10;
    const baseBins = new Array(binCount).fill(0);
    const targetBins = new Array(binCount).fill(0);

    // Group predicted probabilities into 10 decile bins
    for (const o of base) {
      const idx = Math.min(binCount - 1, Math.floor(o.predictedProbability * binCount));
      baseBins[idx]++;
    }
    for (const o of target) {
      const idx = Math.min(binCount - 1, Math.floor(o.predictedProbability * binCount));
      targetBins[idx]++;
    }

    let psi = 0;
    let kl = 0;
    let js = 0;

    const basePct = baseBins.map((c) => Math.max(0.0001, c / base.length));
    const targetPct = targetBins.map((c) => Math.max(0.0001, c / target.length));

    for (let i = 0; i < binCount; i++) {
      const b = basePct[i];
      const t = targetPct[i];

      // Population Stability Index
      psi += (t - b) * Math.log(t / b);

      // Kullback-Leibler Divergence: KL(target || base)
      kl += t * Math.log(t / b);
    }

    // Jensen-Shannon Divergence: Symmetrical
    const avgPct = basePct.map((b, i) => 0.5 * (b + targetPct[i]));
    let klPM = 0;
    let klQM = 0;
    for (let i = 0; i < binCount; i++) {
      klPM += targetPct[i] * Math.log(targetPct[i] / avgPct[i]);
      klQM += basePct[i] * Math.log(basePct[i] / avgPct[i]);
    }
    js = 0.5 * klPM + 0.5 * klQM;

    let driftStatus: 'STABLE' | 'WARNING' | 'DRIFT_DETECTED' = 'STABLE';
    if (psi > 0.1) driftStatus = 'WARNING';
    if (psi > 0.25) driftStatus = 'DRIFT_DETECTED';

    return {
      psi: Math.round(psi * 10000) / 10000,
      klDivergence: Math.round(kl * 10000) / 10000,
      jsDivergence: Math.round(js * 10000) / 10000,
      driftStatus,
    };
  }
}
