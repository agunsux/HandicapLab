export interface CalibratedOutput {
  probabilities: number[]; // Normalized true probabilities (e.g., [pHome, pDraw, pAway])
  uncertaintyScore: number; // 0.0 to 1.0 (0 = absolute confidence, 1 = max uncertainty)
}

export interface ICalibrator {
  /**
   * Fit the calibrator to historical data.
   * @param rawProbs Array of raw probability arrays
   * @param actualOutcomes Array of actual outcomes, one-hot encoded
   * @param sampleWeights Optional weights for temporal decay
   */
  fit(rawProbs: number[][], actualOutcomes: number[][], sampleWeights?: number[]): void;
  
  /**
   * Transform raw probabilities into calibrated probabilities.
   * @param rawProbs Raw probability array
   */
  transform(rawProbs: number[]): CalibratedOutput;
  
  /**
   * Export calibrator state as a JSON string.
   */
  exportState(): string;
  
  /**
   * Import calibrator state from a JSON string.
   */
  importState(state: string): void;
}
