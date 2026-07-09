// Integration Test — Full Pipeline: Validation → Benchmark → Statistics → Report
import { describe, it, expect } from 'vitest';
import { runBenchmarkSuite, simulationToBenchmarkInput } from '../../src/lib/benchmark/runner';
import { bootstrapCI, wilsonInterval, binomialTest, permutationTest, adjustPValues } from '../../src/lib/stats/confidence';
import { calculatePSI, detectCalibrationDrift, detectPredictionDrift, detectROIDrift, runDriftDetection } from '../../src/lib/drift/detector';
import { validateBatch, validateOdds, validateProbability, validateChronology } from '../../src/lib/quality/validator';
import { generateJSONReport, generateHTMLReport } from '../../src/lib/reports/generator';
import { runWalkForwardValidation, generateWalkForwardWindows } from '../../src/lib/validation/walkforward';
import { calculateECE, logLoss, brierScore, sigmoid, factorial, normalCDF, removeVig, kellyFraction, poissonProb } from '../../src/lib/math/metrics';

const mockData = Array.from({ length: 100 }, (_, i) => ({
  matchId: `match_${i}`,
  modelHomeProb: 0.48 + Math.random() * 0.04,
  modelDrawProb: 0.25 + Math.random() * 0.02,
  modelAwayProb: 0.27 + Math.random() * 0.02,
  oddsHome: 1.8 + Math.random() * 0.4, oddsDraw: 3.2 + Math.random() * 0.6, oddsAway: 3.8 + Math.random() * 1.0,
  openingOddsHome: 1.85 + Math.random() * 0.4, openingOddsDraw: 3.3 + Math.random() * 0.6, openingOddsAway: 3.7 + Math.random() * 1.0,
  outcome: (i % 3 === 0 ? 'home' : i % 3 === 1 ? 'draw' : 'away') as 'home' | 'draw' | 'away',
  isHomeFavorite: true, isAwayFavorite: false,
}));

describe('Integration: Full Research Pipeline', () => {
  it('1. Benchmark runs all 10 baseline models with valid metrics', () => {
    const results = runBenchmarkSuite(mockData);
    expect(results).toHaveLength(10);
    const ids = results.map(r => r.modelId);
    expect(ids).toContain('CLOSING_ODDS');
    expect(ids).toContain('OPENING_ODDS');
    expect(ids).toContain('ALWAYS_HOME');
    expect(ids).toContain('ALWAYS_AWAY');
    expect(ids).toContain('ALWAYS_DRAW');
    expect(ids).toContain('RANDOM');
    expect(ids).toContain('MARKET_IMPLIED');
    expect(ids).toContain('FLAT_50');
    for (const r of results) {
      expect(r.metrics.roi).not.toBeNaN();
      expect(r.metrics.accuracy).not.toBeNaN();
      expect(r.metrics.logLoss).not.toBeNaN();
      expect(r.metrics.brierScore).not.toBeNaN();
      expect(r.metrics.calibrationError).not.toBeNaN();
      expect(r.metrics.totalBets).toBe(100);
    }
  });

  it('2. Benchmark with custom model (11 models total)', () => {
    const r = runBenchmarkSuite(mockData, () => ({ prob: 0.52, side: 'home' as const }));
    expect(r).toHaveLength(11);
  });

  it('3. Simulation input conversion', () => {
    const sim = Array.from({ length: 5 }, (_, i) => ({
      pred: { ml_home_prob: 0.5, ml_draw_prob: 0.25, ml_away_prob: 0.25 },
      input: { odds_home: 2.0, odds_draw: 3.5, odds_away: 3.8 },
      outcome: { homeWin: i % 2 === 0, draw: false, awayWin: i % 2 !== 0 },
    }));
    const inputs = simulationToBenchmarkInput(sim);
    expect(inputs).toHaveLength(5);
    expect(inputs[0].oddsHome).toBe(2.0);
  });

  it('4. Bootstrap CI on benchmark ROI', () => {
    const rois = runBenchmarkSuite(mockData).map(r => r.metrics.roi);
    const ci = bootstrapCI(rois);
    expect(ci.mean).not.toBeNaN();
    expect(ci.ci95.lower).toBeLessThanOrEqual(ci.ci95.upper);
    expect(ci.distribution).toHaveLength(10000);
  });

  it('5. Wilson interval on accuracy', () => {
    const best = runBenchmarkSuite(mockData)[0];
    const ci = wilsonInterval(best.metrics.winningBets, best.metrics.totalBets);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
  });

  it('6. Drift detection produces valid report', () => {
    const trainR = runBenchmarkSuite(mockData.slice(0, 50));
    const valR = runBenchmarkSuite(mockData.slice(50));
    const drift = runDriftDetection(
      { ece: trainR.map(m => m.metrics.calibrationError), probabilities: [0.5], roi: trainR.map(m => m.metrics.roi), clv: [0.01] },
      { ece: valR[0].metrics.calibrationError, probabilities: [0.52], roi: valR[0].metrics.roi, clv: 0.02 }
    );
    expect(drift.overallStatus).toMatch(/HEALTHY|WARNING|CRITICAL/);
    expect(drift.drifts.length).toBeGreaterThanOrEqual(3);
    for (const d of drift.drifts) {
      expect(d.psi).toBeGreaterThanOrEqual(0);
      expect(['NONE', 'WARNING', 'CRITICAL']).toContain(d.severity);
    }
  });

  it('7. Data quality blocks FATAL errors', () => {
    expect(validateBatch(mockData.map(d => ({
      matchId: d.matchId, oddsHome: d.oddsHome, oddsDraw: d.oddsDraw, oddsAway: d.oddsAway,
      homeProb: d.modelHomeProb, drawProb: d.modelDrawProb, awayProb: d.modelAwayProb,
    }))).passed).toBe(true);
    const bad = validateBatch([{ matchId: 'bad', oddsHome: NaN, oddsDraw: 2.0, oddsAway: 3.0, homeProb: 0.5, drawProb: 0.25, awayProb: 0.25 }]);
    expect(bad.passed).toBe(false);
    expect(bad.fatalCount).toBeGreaterThan(0);
  });

  it('8. Report generates valid JSON and HTML', () => {
    const valData = { title: 'Test', timestamp: new Date().toISOString(), validationType: 'oos' as const, metrics: { accuracy: 0.55, logLoss: 0.69, brierScore: 0.22, ece: 0.05, roi: 0.02, yield_: 2.0, expectedValue: 0.01, sampleSize: 100 }, confidence: { lower95: -0.05, upper95: 0.08 }, passed: true };
    const json = generateJSONReport(valData);
    expect(() => JSON.parse(json)).not.toThrow();
    const html = generateHTMLReport(valData);
    expect(html).toContain('Test');
    expect(html).toContain('PASSED');
  });

  it('9. Walk-forward end-to-end', () => {
    const { windows, trainData, valData } = generateWalkForwardWindows(mockData, 0.6, 0.3, 0.15);
    expect(windows.length).toBeGreaterThanOrEqual(1);
    const result = runWalkForwardValidation(valData[0], trainData[0], windows[0]);
    expect(result.benchmarkResults).toHaveLength(10);
    expect(result.driftReport.overallStatus).toMatch(/HEALTHY|WARNING|CRITICAL/);
    expect(result.reportJSON).toBeTruthy();
    expect(result.reportHTML).toContain('Walk-Forward');
  });

  it('10. Canonical math functions are correct', () => {
    expect(calculateECE([0.5, 0.6], [1, 0])).toBeGreaterThanOrEqual(0);
    expect(logLoss(0.5, 1)).toBeGreaterThan(0);
    expect(brierScore(0.5, 1)).toBe(0.25);
    expect(sigmoid(0)).toBe(0.5);
    expect(factorial(5)).toBe(120);
    expect(normalCDF(0)).toBeCloseTo(0.5, 2);
    expect(poissonProb(1, 1.5)).toBeGreaterThan(0);
    const v = removeVig(2.0, 3.5, 3.8);
    expect(v.homeProb + v.drawProb + v.awayProb).toBeCloseTo(1, 2);
    expect(kellyFraction(0.6, 2.0)).toBeGreaterThan(0);
  });

  it('11. Statistical tests produce valid p-values', () => {
    const bt = binomialTest(30, 100, 0.25);
    expect(bt.pValue).toBeGreaterThanOrEqual(0);
    expect(bt.pValue).toBeLessThanOrEqual(1);
    const pt = permutationTest([1, 1, 0, 1], [0, 0, 1, 0]);
    expect(pt.pValue).toBeGreaterThanOrEqual(0);
    expect(pt.pValue).toBeLessThanOrEqual(1);
    const adj = adjustPValues([0.01, 0.04, 0.2]);
    expect(adj.adjustedPValues).toHaveLength(3);
    for (const p of adj.adjustedPValues) expect(p).toBeGreaterThanOrEqual(0);
    for (const p of adj.adjustedPValues) expect(p).toBeLessThanOrEqual(1);
  });
});
