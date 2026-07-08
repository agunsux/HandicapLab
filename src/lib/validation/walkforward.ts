// Walk-Forward Validation — Production Module
// Location: src/lib/validation/walkforward.ts
// Integrates: Benchmark → Statistics → Drift → Report pipeline

import { runBenchmarkSuite, BenchmarkInput, BenchmarkResult } from '../benchmark/runner';
import { bootstrapCI, wilsonInterval, binomialTest, roiConfidenceInterval } from '../stats/confidence';
import { runDriftDetection, DriftReport } from '../drift/detector';
import { generateHTMLReport, generateJSONReport, ValidationReportData, BenchmarkReportData } from '../reports/generator';
import { validateBatch, QualityReport } from '../quality/validator';

export interface WalkForwardWindow {
  trainStart: Date;
  trainEnd: Date;
  valStart: Date;
  valEnd: Date;
  windowIndex: number;
}

export interface WalkForwardResult {
  window: WalkForwardWindow;
  benchmarkResults: BenchmarkResult[];
  confidence95: { roi: { lower: number; upper: number }; accuracy: { lower: number; upper: number } };
  driftReport: DriftReport;
  qualityReport: QualityReport;
  reportJSON: string;
  reportHTML: string;
}

/**
 * Generate walk-forward windows from a sorted dataset.
 */
export function generateWalkForwardWindows(
  data: BenchmarkInput[],
  trainRatio: number = 0.7,
  windowSize: number = 0.2,
  stepSize: number = 0.1
): { windows: WalkForwardWindow[]; trainData: BenchmarkInput[][]; valData: BenchmarkInput[][] } {
  const n = data.length;
  const windowLen = Math.floor(n * windowSize);
  const stepLen = Math.floor(n * stepSize);
  const trainLen = Math.floor(n * trainRatio);
  const windows: WalkForwardWindow[] = [];
  const trainData: BenchmarkInput[][] = [];
  const valData: BenchmarkInput[][] = [];

  for (let start = 0; start + windowLen <= n; start += stepLen) {
    const trainStartIdx = Math.max(0, start);
    const trainEndIdx = start + trainLen;
    const valStartIdx = start + trainLen;
    const valEndIdx = Math.min(n, valStartIdx + windowLen);

    if (valEndIdx > n || valStartIdx >= n) break;

    const window: WalkForwardWindow = {
      trainStart: new Date(),
      trainEnd: new Date(),
      valStart: new Date(),
      valEnd: new Date(),
      windowIndex: windows.length,
    };

    windows.push(window);
    trainData.push(data.slice(trainStartIdx, trainEndIdx));
    valData.push(data.slice(valStartIdx, valEndIdx));
  }

  return { windows, trainData, valData };
}

/**
 * Run full validation pipeline for a single walk-forward window:
 * 1. Run benchmarks on validation data
 * 2. Compute confidence intervals
 * 3. Detect drift between train and validation
 * 4. Validate data quality
 * 5. Generate JSON + HTML reports
 */
export function runWalkForwardValidation(
  valData: BenchmarkInput[],
  trainData: BenchmarkInput[],
  window: WalkForwardWindow
): WalkForwardResult {
  // Step 1: Benchmark
  const benchmarkResults = runBenchmarkSuite(valData);

  // Step 2: Confidence intervals on best model's ROI
  const bestModel = benchmarkResults[0];
  const roiCI = roiConfidenceInterval(
    valData.map(d => {
      const odds = d.outcome === 'home' ? d.oddsHome : d.outcome === 'draw' ? d.oddsDraw : d.oddsAway;
      return bestModel.modelId === 'CLOSING_ODDS' ? (1 - 1/odds) : bestModel.metrics.roi;
    })
  );
  const accWilson = wilsonInterval(
    bestModel.metrics.winningBets,
    bestModel.metrics.totalBets
  );

  // Step 3: Drift detection
  const trainModel = runBenchmarkSuite(trainData);
  const driftReport = runDriftDetection(
    {
      ece: trainModel.map(m => m.metrics.calibrationError),
      probabilities: trainData.map(d => d.modelHomeProb),
      roi: trainModel.map(m => m.metrics.roi),
      clv: [],
    },
    {
      ece: bestModel.metrics.calibrationError,
      probabilities: valData.map(d => d.modelHomeProb),
      roi: bestModel.metrics.roi,
      clv: null,
    }
  );

  // Step 4: Data quality
  const qualityReport = validateBatch(
    valData.map(d => ({
      matchId: d.matchId,
      oddsHome: d.oddsHome,
      oddsDraw: d.oddsDraw,
      oddsAway: d.oddsAway,
      homeProb: d.modelHomeProb,
      drawProb: d.modelDrawProb,
      awayProb: d.modelAwayProb,
    }))
  );

  // Step 5: Generate reports
  const valReportData: ValidationReportData = {
    title: `Walk-Forward Window ${window.windowIndex} — Validation Report`,
    timestamp: new Date().toISOString(),
    validationType: 'walkforward',
    metrics: {
      accuracy: bestModel.metrics.accuracy,
      logLoss: bestModel.metrics.logLoss,
      brierScore: bestModel.metrics.brierScore,
      ece: bestModel.metrics.calibrationError,
      roi: bestModel.metrics.roi,
      yield_: bestModel.metrics.yield,
      expectedValue: bestModel.metrics.expectedValue,
      sampleSize: bestModel.metrics.totalBets,
    },
    confidence: { lower95: roiCI.lower, upper95: roiCI.upper },
    passed: qualityReport.passed && driftReport.overallStatus === 'HEALTHY',
  };

  return {
    window,
    benchmarkResults,
    confidence95: { roi: { lower: roiCI.lower, upper: roiCI.upper }, accuracy: { lower: accWilson.lower, upper: accWilson.upper } },
    driftReport,
    qualityReport,
    reportJSON: generateJSONReport(valReportData),
    reportHTML: generateHTMLReport(valReportData),
  };
}
