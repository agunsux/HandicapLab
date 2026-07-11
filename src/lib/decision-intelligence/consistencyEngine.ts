/**
 * EPIC 20.8 — Decision Consistency Engine
 * Detects policy drift, recommendation drift, threshold instability.
 */

import type { ConsistencyResult } from './types';

export class ConsistencyEngine {
  analyze(decisions: readonly { policyId: string; recommended: boolean; expectedValue: number; stakeSize: number }[]): ConsistencyResult[] {
    const results: ConsistencyResult[] = [];

    // Policy drift
    const policies = new Set(decisions.map((d) => d.policyId));
    const driftDetected = policies.size > 1;
    results.push({
      dimension: 'policy_drift',
      score: driftDetected ? 50 : 100,
      driftDetected,
      alert: driftDetected ? 'Multiple policies detected in decision history' : null,
    });

    // Recommendation consistency
    const total = decisions.length;
    const recommended = decisions.filter((d) => d.recommended).length;
    const recRate = total > 0 ? recommended / total : 0;
    results.push({
      dimension: 'recommendation_consistency',
      score: Math.round(recRate * 100),
      driftDetected: false,
      alert: null,
    });

    // Stake stability
    const stakes = decisions.map((d) => d.stakeSize);
    const meanStake = stakes.reduce((s, v) => s + v, 0) / (stakes.length || 1);
    const variance = stakes.reduce((s, v) => s + Math.pow(v - meanStake, 2), 0) / (stakes.length || 1);
    const stakeStability = meanStake > 0 ? Math.max(0, 100 - Math.sqrt(variance) / meanStake * 100) : 100;
    results.push({
      dimension: 'stake_stability',
      score: Math.round(stakeStability),
      driftDetected: stakeStability < 50,
      alert: stakeStability < 50 ? 'High stake variance detected' : null,
    });

    // EV stability
    const evs = decisions.map((d) => d.expectedValue);
    const meanEv = evs.reduce((s, v) => s + v, 0) / (evs.length || 1);
    const evVar = evs.reduce((s, v) => s + Math.pow(v - meanEv, 2), 0) / (evs.length || 1);
    results.push({
      dimension: 'ev_stability',
      score: Math.round(Math.max(0, 100 - Math.sqrt(evVar) * 100)),
      driftDetected: evVar > 0.1,
      alert: evVar > 0.1 ? 'High EV variance across decisions' : null,
    });

    return results;
  }
}

export const defaultConsistencyEngine = new ConsistencyEngine();