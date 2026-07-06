export type OddsBucket = 'Favorite (<1.70)' | 'Moderate Favorite (1.70-2.20)' | 'Even Match (2.20-3.00)' | 'Underdog (3.00-5.00)' | 'Heavy Underdog (>5.00)';

export interface CalibrationResult {
  bucket: OddsBucket;
  expectedWinRate: number;
  actualWinRate: number;
  ece: number; // Expected Calibration Error
  sampleSize: number;
}

export interface ConfidenceBucketResult {
  confidenceRange: string; // e.g. "90-100%"
  expectedWinRate: number;
  actualWinRate: number;
  sampleSize: number;
}

export interface CalibrationReport {
  overallECE: number;
  byOddsBucket: CalibrationResult[];
  byConfidenceBucket: ConfidenceBucketResult[];
  calibrationDrift: {
    month: string;
    ece: number;
  }[];
}

/**
 * CalibrationAnalyzer
 * Audits model calibration across specific domains (Odds, Confidence, Time).
 */
export class CalibrationAnalyzer {
  
  /**
   * Evaluates the calibration of predictions
   */
  async run(predictions: any[]): Promise<CalibrationReport> {
    // Stub for computing actual ECE and binning
    return {
      overallECE: 0.021,
      byOddsBucket: [
        { bucket: 'Favorite (<1.70)', expectedWinRate: 0.65, actualWinRate: 0.64, ece: 0.01, sampleSize: 1200 },
        { bucket: 'Moderate Favorite (1.70-2.20)', expectedWinRate: 0.50, actualWinRate: 0.49, ece: 0.01, sampleSize: 900 },
        { bucket: 'Even Match (2.20-3.00)', expectedWinRate: 0.38, actualWinRate: 0.35, ece: 0.03, sampleSize: 800 },
        { bucket: 'Underdog (3.00-5.00)', expectedWinRate: 0.25, actualWinRate: 0.22, ece: 0.03, sampleSize: 500 },
        { bucket: 'Heavy Underdog (>5.00)', expectedWinRate: 0.10, actualWinRate: 0.05, ece: 0.05, sampleSize: 150 },
      ],
      byConfidenceBucket: [
        { confidenceRange: '90-100%', expectedWinRate: 0.95, actualWinRate: 0.92, sampleSize: 50 },
        { confidenceRange: '80-90%', expectedWinRate: 0.85, actualWinRate: 0.83, sampleSize: 150 },
        { confidenceRange: '70-80%', expectedWinRate: 0.75, actualWinRate: 0.76, sampleSize: 300 },
      ],
      calibrationDrift: [
        { month: 'Aug', ece: 0.015 },
        { month: 'Sep', ece: 0.018 },
        { month: 'Oct', ece: 0.022 },
        { month: 'Nov', ece: 0.028 }, // Example of calibration drifting worse
      ]
    };
  }
}
