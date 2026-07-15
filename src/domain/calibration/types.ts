/**
 * SUPER EPIC 31B.5 — Calibration Domain Types
 */

export type CalibrationAlgorithm = 'platt' | 'isotonic' | 'temp_scaling' | 'beta' | 'none';

export interface CalibrationMetadata {
  calibrationId: string;
  algorithm: CalibrationAlgorithm;
  trainingWindow: string; // e.g. "2020-2021"
  parameters: Record<string, number>; // e.g. { plattA: 1.02, plattB: -0.01 }
  ece: number; // ECE validation score
  logLoss: number; // Log Loss validation score
  trainingDate: string;
  validationDate: string;
}
