// Model Drift Detection — PSI, Prediction Drift, Calibration Drift, ROI/CLV Drift
// Location: src/lib/drift/detector.ts

export interface DriftResult {
  metric: string;
  psi: number;
  driftDetected: boolean;
  severity: 'NONE' | 'WARNING' | 'CRITICAL';
  threshold: number;
  currentValue: number;
  historicalValue: number;
  absoluteChange: number;
  percentChange: number;
}

export interface DriftReport {
  timestamp: string;
  modelVersion: string;
  drifts: DriftResult[];
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

/**
 * Population Stability Index (PSI) — measures distribution shift.
 * PSI < 0.1: no shift, 0.1-0.25: moderate shift, > 0.25: severe shift.
 */
export function calculatePSI(expected: number[], observed: number[], bins: number = 10): number {
  const n = expected.length;
  if (n === 0 || observed.length === 0) return 0;
  const min = Math.min(...expected, ...observed);
  const max = Math.max(...expected, ...observed);
  const range = max - min || 1;
  const binSize = range / bins;
  let psi = 0;
  for (let i = 0; i < bins; i++) {
    const lower = min + i * binSize;
    const upper = lower + binSize;
    const eCount = expected.filter(v => v >= lower && v < upper).length;
    const oCount = observed.filter(v => v >= lower && v < upper).length;
    const ePct = (eCount + 0.5) / (n + bins * 0.5);
    const oPct = (oCount + 0.5) / (observed.length + bins * 0.5);
    psi += (oPct - ePct) * Math.log(oPct / ePct);
  }
  return psi;
}

/**
 * Detect calibration drift by comparing ECE over time windows.
 */
export function detectCalibrationDrift(
  historicalECE: number[],
  currentECE: number,
  threshold: number = 0.05
): DriftResult {
  const histMean = historicalECE.length > 0
    ? historicalECE.reduce((s, v) => s + v, 0) / historicalECE.length
    : currentECE;
  const change = currentECE - histMean;
  const pctChange = histMean !== 0 ? Math.abs(change / histMean) : Math.abs(change);
  const psi = calculatePSI(historicalECE.length > 0 ? historicalECE : [histMean], [currentECE]);
  let severity: 'NONE' | 'WARNING' | 'CRITICAL' = 'NONE';
  if (psi > 0.25 || Math.abs(change) > threshold * 2) severity = 'CRITICAL';
  else if (psi > 0.1 || Math.abs(change) > threshold) severity = 'WARNING';
  return { metric: 'calibration_error', psi, driftDetected: severity !== 'NONE', severity, threshold, currentValue: currentECE, historicalValue: histMean, absoluteChange: change, percentChange: pctChange * 100 };
}

/**
 * Detect prediction drift by comparing probability distributions.
 */
export function detectPredictionDrift(
  historicalProbs: number[], currentProbs: number[], threshold: number = 0.1
): DriftResult {
  const psi = calculatePSI(historicalProbs, currentProbs);
  const histMean = historicalProbs.reduce((s, v) => s + v, 0) / historicalProbs.length;
  const currMean = currentProbs.reduce((s, v) => s + v, 0) / currentProbs.length;
  const change = currMean - histMean;
  let severity: 'NONE' | 'WARNING' | 'CRITICAL' = 'NONE';
  if (psi > 0.25) severity = 'CRITICAL';
  else if (psi > threshold) severity = 'WARNING';
  return { metric: 'prediction_drift', psi, driftDetected: severity !== 'NONE', severity, threshold, currentValue: currMean, historicalValue: histMean, absoluteChange: change, percentChange: histMean !== 0 ? (Math.abs(change) / histMean) * 100 : 0 };
}

/**
 * Detect ROI drift over time.
 */
export function detectROIDrift(historicalROI: number[], currentROI: number, threshold: number = 0.02): DriftResult {
  const histMean = historicalROI.length > 0 ? historicalROI.reduce((s, v) => s + v, 0) / historicalROI.length : currentROI;
  const change = currentROI - histMean;
  const psi = calculatePSI(historicalROI.length > 0 ? historicalROI : [histMean], [currentROI]);
  let severity: 'NONE' | 'WARNING' | 'CRITICAL' = 'NONE';
  if (psi > 0.25 || Math.abs(change) > threshold * 3) severity = 'CRITICAL';
  else if (psi > 0.1 || Math.abs(change) > threshold) severity = 'WARNING';
  return { metric: 'roi_drift', psi, driftDetected: severity !== 'NONE', severity, threshold, currentValue: currentROI, historicalValue: histMean, absoluteChange: change, percentChange: histMean !== 0 ? (Math.abs(change) / Math.abs(histMean)) * 100 : 0 };
}

/**
 * Detect CLV drift over time.
 */
export function detectCLVDrift(historicalCLV: number[], currentCLV: number, threshold: number = 0.01): DriftResult {
  const histMean = historicalCLV.length > 0 ? historicalCLV.reduce((s, v) => s + v, 0) / historicalCLV.length : currentCLV;
  const change = currentCLV - histMean;
  const psi = calculatePSI(historicalCLV.length > 0 ? historicalCLV : [histMean], [currentCLV]);
  let severity: 'NONE' | 'WARNING' | 'CRITICAL' = 'NONE';
  if (psi > 0.25 || Math.abs(change) > threshold * 3) severity = 'CRITICAL';
  else if (psi > 0.1 || Math.abs(change) > threshold) severity = 'WARNING';
  return { metric: 'clv_drift', psi, driftDetected: severity !== 'NONE', severity, threshold, currentValue: currentCLV, historicalValue: histMean, absoluteChange: change, percentChange: histMean !== 0 ? (Math.abs(change) / Math.abs(histMean)) * 100 : 0 };
}

/**
 * Run complete drift detection suite across all metrics.
 */
export function runDriftDetection(
  historicalData: { ece: number[]; probabilities: number[]; roi: number[]; clv: number[] },
  currentData: { ece: number; probabilities: number[]; roi: number; clv: number | null },
  modelVersion: string = 'unknown'
): DriftReport {
  const drifts: DriftResult[] = [];
  drifts.push(detectCalibrationDrift(historicalData.ece, currentData.ece));
  drifts.push(detectPredictionDrift(historicalData.probabilities, currentData.probabilities));
  drifts.push(detectROIDrift(historicalData.roi, currentData.roi));
  if (currentData.clv !== null) drifts.push(detectCLVDrift(historicalData.clv, currentData.clv));
  const criticalCount = drifts.filter(d => d.severity === 'CRITICAL').length;
  const warningCount = drifts.filter(d => d.severity === 'WARNING').length;
  let overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (criticalCount > 0) overallStatus = 'CRITICAL';
  else if (warningCount > 0) overallStatus = 'WARNING';
  return { timestamp: new Date().toISOString(), modelVersion, drifts, overallStatus };
}
