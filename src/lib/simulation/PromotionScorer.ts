import { SimulationMetrics, Experiment, EvidenceLevel, PromotionScoreDetails } from './types';

export class PromotionScorer {
  /**
   * Calculates a composite 0-100 Promotion Score.
   * Prevents models from being promoted just because "yield went up",
   * ensuring stability, coverage, and evidence quality are factored in.
   */
  static score(base: SimulationMetrics, cand: SimulationMetrics, evidenceLevel: EvidenceLevel): { compositeScore: number, details: PromotionScoreDetails } {
    
    // 1. Utility Improvement (Yield) - 30% weight
    const yieldDiff = cand.yield - base.yield;
    let utilityScore = 50; // Baseline
    if (yieldDiff > 0) utilityScore += (yieldDiff * 1000); // e.g. +0.02 (2%) = +20 pts -> 70
    if (yieldDiff < 0) utilityScore -= (Math.abs(yieldDiff) * 2000); // Penalize drops heavily
    utilityScore = Math.max(0, Math.min(100, utilityScore));

    // 2. Coverage (Volume of decisions) - 15% weight
    // Massive drops in coverage to boost yield are penalized.
    const coverageDiff = cand.coverage - base.coverage;
    let coverageScore = 50;
    if (coverageDiff >= 0) coverageScore = 80;
    if (coverageDiff < -0.10) coverageScore = 20; // Dropped more than 10% volume

    // 3. Decision Quality (Correct skips vs missed opportunities) - 25% weight
    let dqScore = 50;
    const skipDiff = cand.correctSkips - base.correctSkips;
    const missDiff = cand.missedOpportunities - base.missedOpportunities;
    dqScore += (skipDiff * 2) - (missDiff * 3);
    dqScore = Math.max(0, Math.min(100, dqScore));

    // 4. Evidence Level Multiplier
    // L0-L1 (Proxy) max score is capped or scaled down.
    // L2 (Full Replay) is standard 1.0x.
    let multiplier = 1.0;
    switch (evidenceLevel) {
      case 'L0': multiplier = 0.2; break;
      case 'L1': multiplier = 0.6; break; // Proxies cannot easily achieve 90+ promotion scores
      case 'L2': multiplier = 1.0; break;
      case 'L3': multiplier = 1.1; break;
      case 'L4': multiplier = 1.2; break;
      case 'L5': multiplier = 1.0; break;
    }

    const unadjustedScore = (utilityScore * 0.4) + (coverageScore * 0.2) + (dqScore * 0.4);
    const compositeScore = Math.max(0, Math.min(100, Math.round(unadjustedScore * multiplier)));

    return {
      compositeScore,
      details: {
        utilityImprovementScore: Math.round(utilityScore),
        calibrationStabilityScore: 50, // Scaffolded
        coverageScore: Math.round(coverageScore),
        healthImpactScore: 50, // Scaffolded
        driverStabilityScore: 50, // Scaffolded
        decisionQualityScore: Math.round(dqScore),
        evidenceLevelMultiplier: multiplier
      }
    };
  }
}
