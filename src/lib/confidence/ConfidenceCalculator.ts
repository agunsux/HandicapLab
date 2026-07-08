export class ConfidenceCalculator {
  /**
   * Calculates a composite confidence score based on multiple factors.
   * 
   * Formula:
   * Prediction Confidence = Calibration Quality × Model Stability × Data Coverage × OOD Score × Agreement Score
   *
   * @param calibrationQuality 0-1, 1 means perfectly calibrated (e.g., derived from ECE)
   * @param modelStability 0-1, 1 means model is highly stable for this specific regime
   * @param dataCoverage 0-1, 1 means training data was rich in this area
   * @param oodScore 0-1, 1 means completely in-distribution (0 means completely out-of-distribution)
   * @param agreementScore 0-1, 1 means ensemble agreement is unanimous
   */
  static calculate(
    calibrationQuality: number,
    modelStability: number,
    dataCoverage: number,
    oodScore: number,
    agreementScore: number
  ): number {
    return calibrationQuality * modelStability * dataCoverage * oodScore * agreementScore;
  }
}
