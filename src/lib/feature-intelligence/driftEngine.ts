/**
 * EPIC 19.7 — Feature Drift Detection
 */

import type { FeatureDriftResult, FeatureDriftReport } from './types';
import { generateFDriftId } from './id';

function eps(v: number): number { return Math.max(v, 1e-10); }
function histogram(values: number[], bins: number): number[] {
  const h = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(v * bins));
    h[idx]++;
  }
  return h;
}

function computePSI(baseline: number[], current: number[], bins = 10): number {
  const bH = histogram(baseline, bins);
  const cH = histogram(current, bins);
  let psi = 0;
  for (let i = 0; i < bins; i++) {
    const bp = eps(bH[i] / baseline.length);
    const cp = eps(cH[i] / current.length);
    psi += (cp - bp) * Math.log(cp / bp);
  }
  return psi;
}

function computeKL(p: number[], q: number[]): number {
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    kl += eps(p[i]) * Math.log(eps(p[i]) / eps(q[i]));
  }
  return kl;
}

function computeJS(p: number[], q: number[]): number {
  const m = p.map((v, i) => (v + q[i]) / 2);
  return Math.sqrt((computeKL(p, m) + computeKL(q, m)) / 2);
}

function computeEMD(baseline: number[], current: number[]): number {
  const sb = [...baseline].sort((a, b) => a - b);
  const sc = [...current].sort((a, b) => a - b);
  const ml = Math.max(sb.length, sc.length);
  let emd = 0;
  for (let i = 0; i < ml; i++) emd += Math.abs((sb[i] ?? 0) - (sc[i] ?? 0));
  return emd / ml;
}

function computeKS(baseline: number[], current: number[]): number {
  const all = [...new Set([...baseline, ...current])].sort((a, b) => a - b);
  let maxD = 0;
  for (const t of all) {
    const ecdfB = baseline.filter((v) => v <= t).length / baseline.length;
    const ecdfC = current.filter((v) => v <= t).length / current.length;
    maxD = Math.max(maxD, Math.abs(ecdfB - ecdfC));
  }
  return maxD;
}

export class FeatureDriftEngine {
  detect(featureId: string, baseline: number[], current: number[]): FeatureDriftResult {
    const psi = computePSI(baseline, current);
    const bHist = histogram(baseline, 10).map((c) => c / baseline.length);
    const cHist = histogram(current, 10).map((c) => c / current.length);
    const kl = computeKL(bHist, cHist);
    const js = computeJS(bHist, cHist);
    const emd = computeEMD(baseline, current);
    const ks = computeKS(baseline, current);
    const driftDetected = psi > 0.1 || ks > 0.2;
    const severity: FeatureDriftResult['severity'] = psi > 0.25 ? 'high' : psi > 0.1 ? 'medium' : psi > 0.05 ? 'low' : 'none';

    return {
      featureId,
      psi: Math.round(psi * 10000) / 10000,
      ksStatistic: Math.round(ks * 10000) / 10000,
      klDivergence: Math.round(kl * 10000) / 10000,
      jsDistance: Math.round(js * 10000) / 10000,
      earthMoverDistance: Math.round(emd * 10000) / 10000,
      driftDetected,
      severity,
    };
  }
}

export const defaultFeatureDriftEngine = new FeatureDriftEngine();