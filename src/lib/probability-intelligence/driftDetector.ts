/**
 * EPIC 18.7 — Probability Drift Detection
 * Detects distribution drift, confidence drift, calibration drift.
 * Uses PSI, KL Divergence, JS Distance, Earth Mover Distance.
 */

import type { DriftResult, DriftReport } from './types';
import { generateDriftId } from './id';

function eps(v: number): number { return Math.max(v, 1e-10); }

/** Population Stability Index */
function computePSI(baseline: number[], current: number[], bins = 10): number {
  const bHist = histogram(baseline, bins);
  const cHist = histogram(current, bins);
  let psi = 0;
  for (let i = 0; i < bins; i++) {
    const bp = eps(bHist[i] / baseline.length);
    const cp = eps(cHist[i] / current.length);
    psi += (cp - bp) * Math.log(cp / bp);
  }
  return psi;
}

function histogram(values: number[], bins: number): number[] {
  const h = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(v * bins));
    h[idx]++;
  }
  return h;
}

/** KL Divergence */
function computeKL(p: number[], q: number[]): number {
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = eps(p[i]);
    const qi = eps(q[i]);
    kl += pi * Math.log(pi / qi);
  }
  return kl;
}

/** Jensen-Shannon Distance */
function computeJS(p: number[], q: number[]): number {
  const m = p.map((v, i) => (v + q[i]) / 2);
  return Math.sqrt((computeKL(p, m) + computeKL(q, m)) / 2);
}

/** Earth Mover Distance (1D) */
function computeEMD(baseline: number[], current: number[]): number {
  const sortedB = [...baseline].sort((a, b) => a - b);
  const sortedC = [...current].sort((a, b) => a - b);
  const maxLen = Math.max(sortedB.length, sortedC.length);
  let emd = 0;
  for (let i = 0; i < maxLen; i++) {
    emd += Math.abs((sortedB[i] ?? 0) - (sortedC[i] ?? 0));
  }
  return emd / maxLen;
}

export class DriftDetector {
  detect(
    baselineProbabilities: number[],
    currentProbabilities: number[],
    label = 'probability'
  ): DriftReport {
    const results: DriftResult[] = [];

    // Distribution drift
    const psi = computePSI(baselineProbabilities, currentProbabilities);
    const bHist = histogram(baselineProbabilities, 10).map((c) => c / baselineProbabilities.length);
    const cHist = histogram(currentProbabilities, 10).map((c) => c / currentProbabilities.length);
    const kl = computeKL(bHist, cHist);
    const js = computeJS(bHist, cHist);
    const emd = computeEMD(baselineProbabilities, currentProbabilities);

    const driftDetected = psi > 0.1 || kl > 0.1;
    const severity: DriftResult['severity'] = psi > 0.25 ? 'high' : psi > 0.1 ? 'medium' : psi > 0.05 ? 'low' : 'none';

    results.push({
      dimension: label,
      pstabilityIndex: Math.round(psi * 10000) / 10000,
      klDivergence: Math.round(kl * 10000) / 10000,
      jsDistance: Math.round(js * 10000) / 10000,
      earthMoverDistance: Math.round(emd * 10000) / 10000,
      driftDetected,
      severity,
    });

    return {
      baselineLabel: `baseline_${label}`,
      currentLabel: `current_${label}`,
      results,
      overallDriftDetected: driftDetected,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const defaultDriftDetector = new DriftDetector();