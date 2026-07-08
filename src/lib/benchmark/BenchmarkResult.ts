import { CalibrationRegistryEntry } from '../calibration/CalibrationRegistry';

export class BenchmarkResult {
  constructor(
    public readonly dataset: string,
    public readonly protocol: string,
    public readonly candidates: CalibrationRegistryEntry[]
  ) {}

  /**
   * Selects the champion based on frozen criteria:
   * 1. Lowest ECE is prioritized.
   * 2. If ECE is within margin, tie-break with Brier Score.
   * 3. Must not invert probabilities (monotonicity assumed to be checked before entry).
   */
  public selectWinner(): CalibrationRegistryEntry | null {
    if (this.candidates.length === 0) return null;

    // Filter out candidates with high risk or invalid metrics
    const validCandidates = this.candidates.filter(c => !isNaN(c.ece) && !isNaN(c.brier));
    
    if (validCandidates.length === 0) return null;

    let champion = validCandidates[0];
    
    for (let i = 1; i < validCandidates.length; i++) {
      const candidate = validCandidates[i];
      // If ECE is significantly better (e.g. 0.01 threshold)
      if (candidate.ece < champion.ece - 0.005) {
        champion = candidate;
      } else if (Math.abs(candidate.ece - champion.ece) <= 0.005) {
        // Tie-breaker: Brier score
        if (candidate.brier < champion.brier) {
          champion = candidate;
        }
      }
    }
    
    return champion;
  }
}
