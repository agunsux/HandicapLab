import { describe, it, expect } from 'vitest';
import { ForecastArchiveEngine } from '../src/lib/scientific-validation/forecast-archive';
import { CalibrationLaboratoryEngine } from '../src/lib/scientific-validation/calibration-laboratory';
import { ConfidenceIntervalEngine } from '../src/lib/scientific-validation/confidence-interval-engine';
import { FeatureSimilarityEngineV2 } from '../src/lib/scientific-validation/feature-similarity-engine-v2';
import { ReliabilityDashboardEngine } from '../src/lib/scientific-validation/reliability-dashboard';
import { ScientificFeedbackLoopEngine } from '../src/lib/scientific-validation/scientific-feedback-loop';

describe('EPIC 37 — Scientific Validation Platform Test Suite', () => {
  describe('1. Immutable Forecast Archive & Settlement Engine', () => {
    it('should create immutable forecast record with SHA-256 hashes and compute settlement', () => {
      const archived = ForecastArchiveEngine.archiveForecast({
        fixtureId: 'fix-sc-101',
        modelVersion: 'v1.37.0',
        featureVersion: 'f-v2.1',
        league: 'Premier League',
        market: 'asian_handicap',
        selection: 'home',
        probability: 0.58,
        ciLower: 0.54,
        ciUpper: 0.62,
        modelFairOdds: 1.724,
        bookmakerOdds: 2.05,
        probEdge: 0.08,
        expectedValue: 0.189,
        kellyFraction: 0.045,
        recommendation: 'STRONG_VALUE',
        confidence: 0.72,
        featureVector: { xgDiff: 0.45, eloDiff: 85 },
      });

      expect(archived.featureVectorHash.length).toBe(64); // SHA-256 length
      expect(archived.predictionHash.length).toBe(64);
      expect(archived.ciWidth).toBe(0.08);

      const settlement = ForecastArchiveEngine.settleForecast(archived, 1.95, 'WIN');
      expect(settlement.profit).toBe(1.05); // (2.05 - 1) * 1.0
      expect(settlement.clv).toBeGreaterThan(0.05); // (2.05 / 1.95) - 1
    });
  });

  describe('2. Calibration Laboratory Engine', () => {
    it('should compute Brier score, ECE, MCE, and 10 probability buckets', () => {
      const predictions = Array.from({ length: 200 }).map((_, i) => {
        const prob = (i % 10) / 10 + 0.05;
        const actual = Math.random() < prob ? (1 as const) : (0 as const);
        return { predictedProb: prob, actualOutcome: actual };
      });

      const report = CalibrationLaboratoryEngine.computeCalibrationReport(predictions, 'v1.37.0', 'Premier League');
      expect(report.sampleSize).toBe(200);
      expect(report.brierScore).toBeGreaterThan(0);
      expect(report.ece).toBeGreaterThanOrEqual(0);
      expect(report.buckets.length).toBe(10);
    });
  });

  describe('3. 95% Confidence Interval Engine', () => {
    it('should calculate Wilson Score 95% CI and prohibit naked probabilities', () => {
      const wilson = ConfidenceIntervalEngine.calculateWilsonInterval(0.64, 150);
      expect(wilson.ciLower).toBeLessThan(0.64);
      expect(wilson.ciUpper).toBeGreaterThan(0.64);
      expect(wilson.plusMinusPct).toContain('±');
      expect(wilson.formattedRange).toContain('64.0%');

      const bayesian = ConfidenceIntervalEngine.calculateBayesianInterval(64, 100);
      expect(bayesian.method).toBe('bayesian');
      expect(bayesian.ciWidth).toBeGreaterThan(0);
    });
  });

  describe('4. Feature-Space Similarity Engine v2 (k-NN Matcher)', () => {
    it('should execute k-NN search and return top historical match neighbors', () => {
      const queryVector = {
        xgDiff: 0.45,
        xgaDiff: -0.20,
        shotsDiff: 3.2,
        shotsOnTargetDiff: 1.8,
        ppdaDiff: -2.1,
        restDaysDiff: 1,
        travelKmDiff: -150,
        eloDiff: 85,
        openingOdds: 2.10,
        bookmakerMargin: 0.028,
      };

      const historicalPool = Array.from({ length: 150 }).map((_, i) => ({
        fixtureId: `hist-${i}`,
        matchName: `Match ${i}`,
        season: '2024-2025',
        vector: { ...queryVector, xgDiff: queryVector.xgDiff + (i * 0.005) },
        result: i % 2 === 0 ? ('WIN' as const) : ('LOSS' as const),
        realizedRoi: 0.08,
        realizedClv: 0.04,
      }));

      const res = FeatureSimilarityEngineV2.findNearestNeighbors('q-fix', queryVector, historicalPool, 50);
      expect(res.sampleSize).toBe(50);
      expect(res.topNeighbors.length).toBe(10);
      expect(res.historicalRoi).toBe(0.08);
      expect(res.summaryText).toContain('k=50');
    });
  });

  describe('5. Reliability Dashboard & Feedback Loop', () => {
    it('should aggregate model reliability metrics and run post-settlement feedback loop', () => {
      const summary = ReliabilityDashboardEngine.getModelReliabilitySummary();
      expect(summary.modelVersion).toBe('v1.37.0');
      expect(summary.modelDriftStatus).toBe('STABLE');

      const feedback = ScientificFeedbackLoopEngine.processSettlementFeedback(
        'v1.37.0',
        [{ predictedProb: 0.6, actualOutcome: 1 }, { predictedProb: 0.4, actualOutcome: 0 }]
      );
      expect(feedback.totalSettledFixtures).toBe(2);
      expect(feedback.evolutionLog).toContain('No silent retraining');
    });
  });
});
