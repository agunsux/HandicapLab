import { CalibrationRegistryEntry } from './CalibrationRegistry';

export class AcceptanceGate {
  /**
   * Evaluates a candidate calibration against a baseline (e.g. Raw model).
   * Returns true if it passes all criteria, false otherwise.
   */
  static evaluate(candidate: CalibrationRegistryEntry, baseline: CalibrationRegistryEntry): { approved: boolean; reason?: string } {
    if (isNaN(candidate.ece) || isNaN(candidate.brier) || isNaN(candidate.log_loss)) {
      return { approved: false, reason: 'Invalid metrics (NaN).' };
    }

    // 1. ECE must decrease (or stay same if extremely low already)
    // Using a tiny epsilon to account for floating point comparisons
    if (candidate.ece > baseline.ece + 0.0001) {
      return { approved: false, reason: `ECE worsened from ${baseline.ece} to ${candidate.ece}` };
    }

    // 2. Brier score must not significantly worsen (allow 1% degradation if ECE improves massively, but usually strict)
    if (candidate.brier > baseline.brier + 0.001) {
      return { approved: false, reason: `Brier score worsened from ${baseline.brier} to ${candidate.brier}` };
    }

    // 3. Log Loss must not significantly worsen
    if (candidate.log_loss > baseline.log_loss + 0.005) {
      return { approved: false, reason: `Log Loss worsened from ${baseline.log_loss} to ${candidate.log_loss}` };
    }

    // 4. In a full implementation, we'd check monotonicity and probability inversion here.
    // For this scaffold, we assume those properties are checked during candidate generation 
    // or by evaluating the mapping function.

    return { approved: true };
  }
}
