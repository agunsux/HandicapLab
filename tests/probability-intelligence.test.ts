/**
 * EPIC 18 — Probability Intelligence Platform Tests
 */

import { describe, it, expect } from 'vitest';
import { PROBABILITY_INTELLIGENCE_VERSION, BUILTIN_CALIBRATORS } from '../src/lib/probability-intelligence/types';
import { CalibratorRegistry } from '../src/lib/probability-intelligence/calibrators';
import { ReliabilityEngine } from '../src/lib/probability-intelligence/reliabilityEngine';
import { CalibrationMetricsEngine } from '../src/lib/probability-intelligence/calibrationMetrics';
import { ComparisonEngine } from '../src/lib/probability-intelligence/comparisonEngine';
import { CrossValidationEngine } from '../src/lib/probability-intelligence/crossValidation';
import { DriftDetector } from '../src/lib/probability-intelligence/driftDetector';
import { ExplainabilityEngine } from '../src/lib/probability-intelligence/explainability';
import { ReliabilityReportGenerator } from '../src/lib/probability-intelligence/reporting';
import { CalibrationArtifactIntegration } from '../src/lib/probability-intelligence/artifactIntegration';
import { ChampionCalibrationGate } from '../src/lib/probability-intelligence/championCalibrationGate';

function makeProbsAndOutcomes(n = 100): { probs: number[]; outcomes: number[] } {
  const probs: number[] = [];
  const outcomes: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i + 1) / (n + 1);
    probs.push(p);
    outcomes.push(p > 0.5 ? 1 : 0);
  }
  return { probs, outcomes };
}

describe('Constants', () => {
  it('exports correct version', () => {
    expect(PROBABILITY_INTELLIGENCE_VERSION).toBe('1.0.0');
  });

  it('defines 8 calibrator descriptors', () => {
    expect(BUILTIN_CALIBRATORS.length).toBe(8);
    expect(BUILTIN_CALIBRATORS.map((d) => d.id)).toContain('raw');
    expect(BUILTIN_CALIBRATORS.map((d) => d.id)).toContain('platt');
    expect(BUILTIN_CALIBRATORS.map((d) => d.id)).toContain('temperature');
  });
});

describe('EPIC 18.1 — CalibratorRegistry', () => {
  it('registers all calibrators', () => {
    const registry = new CalibratorRegistry();
    expect(registry.ids().length).toBe(4); // raw, platt, temperature, histogram
    expect(registry.get('raw')).toBeDefined();
    expect(registry.get('platt')).toBeDefined();
  });

  it('raw calibrator passes probabilities unchanged', () => {
    const registry = new CalibratorRegistry();
    const raw = registry.get('raw')!;
    const params = raw.train([0.2, 0.5, 0.8], [0, 1, 1]);
    const cal = raw.calibrate([0.2, 0.5, 0.8], params);
    expect(cal[0]).toBe(0.2);
    expect(cal[2]).toBe(0.8);
  });

  it('platt calibrator trains and calibrates', () => {
    const registry = new CalibratorRegistry();
    const platt = registry.get('platt')!;
    const { probs, outcomes } = makeProbsAndOutcomes(50);
    const params = platt.train(probs, outcomes);
    const cal = platt.calibrate(probs, params);
    expect(cal.length).toBe(probs.length);
    expect(cal.every((c) => c >= 0 && c <= 1)).toBe(true);
  });

  it('temperature calibrator finds optimal parameter', () => {
    const registry = new CalibratorRegistry();
    const temp = registry.get('temperature')!;
    const { probs, outcomes } = makeProbsAndOutcomes(30);
    const params = temp.train(probs, outcomes);
    expect(typeof params.data.temperature).toBe('number');
    expect(params.data.temperature).toBeGreaterThan(0);
  });
});

describe('EPIC 18.2 — ReliabilityEngine', () => {
  const engine = new ReliabilityEngine();

  it('builds a reliability curve with proper buckets', () => {
    const { probs, outcomes } = makeProbsAndOutcomes();
    const curve = engine.buildCurve('ds_1', 'ML', 'raw', probs, outcomes, 5);
    expect(curve.buckets.length).toBeGreaterThan(0);
    expect(curve.buckets.every((b) => b.count > 0)).toBe(true);
    expect(typeof curve.ece).toBe('number');
    expect(curve.ece).toBeGreaterThanOrEqual(0);
  });

  it('builds a confidence histogram', () => {
    const hist = engine.buildHistogram([0.1, 0.2, 0.5, 0.8, 0.9]);
    expect(hist.length).toBeGreaterThan(0);
  });
});

describe('EPIC 18.3 — CalibrationMetricsEngine', () => {
  const engine = new CalibrationMetricsEngine();

  it('computes ECE, MCE, ACE, Brier, Log Loss, Sharpness, Resolution', () => {
    const { probs, outcomes } = makeProbsAndOutcomes(200);
    const metrics = engine.compute(probs, outcomes);
    expect(metrics.ece).toBeGreaterThanOrEqual(0);
    expect(metrics.mce).toBeGreaterThanOrEqual(metrics.ece);
    expect(metrics.ace).toBeGreaterThanOrEqual(0);
    expect(metrics.brierScore).toBeGreaterThan(0);
    expect(metrics.logLoss).toBeGreaterThan(0);
    expect(metrics.sharpness).toBeGreaterThan(0);
    expect(typeof metrics.murphyDecomposition.reliability).toBe('number');
  });

  it('returns zeros for empty input', () => {
    const metrics = engine.compute([], []);
    expect(metrics.ece).toBe(0);
    expect(metrics.brierScore).toBe(0);
  });
});

describe('EPIC 18.4 — CrossValidationEngine', () => {
  const engine = new CrossValidationEngine();

  it('runs K-Fold cross validation', () => {
    const { probs, outcomes } = makeProbsAndOutcomes(50);
    const report = engine.runKFold('ds_1', probs, outcomes, 3);
    expect(report.strategy).toBe('kfold');
    expect(report.folds.length).toBe(3);
    expect(typeof report.aggregateMetrics.ece).toBe('number');
    expect(typeof report.stdDevMetrics.ece).toBe('number');
  });
});

describe('EPIC 18.5 — ComparisonEngine', () => {
  const engine = new ComparisonEngine();
  const m1 = { ece: 0.05, mce: 0.1, ace: 0.06, brierScore: 0.2, logLoss: 0.5, negativeLogLikelihood: 50, calibrationLoss: 0.05, sharpness: 0.1, resolution: 0.02, uncertainty: 0.25, murphyDecomposition: { reliability: 0.05, resolution: 0.02, uncertainty: 0.25 } };
  const m2 = { ece: 0.08, mce: 0.15, ace: 0.09, brierScore: 0.25, logLoss: 0.6, negativeLogLikelihood: 60, calibrationLoss: 0.08, sharpness: 0.08, resolution: 0.01, uncertainty: 0.25, murphyDecomposition: { reliability: 0.08, resolution: 0.01, uncertainty: 0.25 } };

  it('compares two calibration strategies', () => {
    const result = engine.compare('raw', 'platt', 'ML', m1, m2);
    expect(result.calibratorA).toBe('raw');
    expect(result.eceDelta).toBeGreaterThan(0); // m2 has worse ECE
    expect(typeof result.significant).toBe('boolean');
  });
});

describe('EPIC 18.7 — DriftDetector', () => {
  const detector = new DriftDetector();

  it('detects no drift between identical distributions', () => {
    const probs = Array.from({ length: 100 }, (_, i) => (i + 1) / 101);
    const report = detector.detect(probs, [...probs]);
    expect(report.results[0].driftDetected).toBe(false);
    expect(report.results[0].pstabilityIndex).toBeCloseTo(0, 1);
  });

  it('detects drift between different distributions', () => {
    const baseline = Array.from({ length: 100 }, (_, i) => (i + 1) / 101);
    const current = Array.from({ length: 100 }, () => Math.random() * 0.3 + 0.6);
    const report = detector.detect(baseline, current);
    expect(typeof report.overallDriftDetected).toBe('boolean');
  });
});

describe('EPIC 18.8 — ExplainabilityEngine', () => {
  const engine = new ExplainabilityEngine();

  it('generates probability explanation with delta', () => {
    const exp = engine.explain({
      fixtureId: 'm1',
      market: 'ML',
      rawProbability: 0.5,
      calibratedProbability: 0.55,
      confidence: 0.8,
      calibrationMethod: 'platt',
    });
    expect(exp.fixtureId).toBe('m1');
    expect(exp.calibrationDelta).toBe(0.05);
    expect(exp.calibrationMethod).toBe('platt');
  });
});

describe('EPIC 18.9 — ReliabilityReportGenerator', () => {
  const gen = new ReliabilityReportGenerator();
  const engine = new ReliabilityEngine();
  const { probs, outcomes } = makeProbsAndOutcomes();
  const curve = engine.buildCurve('ds_1', 'ML', 'raw', probs, outcomes);

  it('generates report with markdown', () => {
    const report = gen.generate({ datasetId: 'ds_1', calibratorId: 'raw', market: 'ML', reliabilityCurve: curve, metrics: { ece: 0.05, mce: 0.1, brierScore: 0.2, logLoss: 0.5 } });
    expect(report.reportId).toMatch(/^pirep_\d{6}$/);
    const md = gen.toMarkdown(report);
    expect(md).toContain('# Reliability Report');
    expect(md).toContain('ECE:');
  });
});

describe('EPIC 18.10 — CalibrationArtifactIntegration', () => {
  const integration = new CalibrationArtifactIntegration();
  const engine = new ReliabilityEngine();
  const { probs, outcomes } = makeProbsAndOutcomes();
  const curve = engine.buildCurve('ds_1', 'ML', 'raw', probs, outcomes);

  it('creates immutable calibration artifact', () => {
    const artifact = integration.createArtifact({
      datasetId: 'ds_1',
      experimentId: 'exp_1',
      modelVersion: '1.0.0',
      featureVersion: '1.0.0',
      calibratorId: 'raw',
      calibrationProfile: { market: 'ML', calibratorId: 'raw', params: {}, metrics: { ece: 0, mce: 0, ace: 0, brierScore: 0, logLoss: 0, negativeLogLikelihood: 0, calibrationLoss: 0, sharpness: 0, resolution: 0, uncertainty: 0, murphyDecomposition: { reliability: 0, resolution: 0, uncertainty: 0 } }, trainedAt: '2025-01-01', trainingSize: 100 },
      reliabilityCurve: curve,
      metrics: { ece: 0, mce: 0, ace: 0, brierScore: 0, logLoss: 0, negativeLogLikelihood: 0, calibrationLoss: 0, sharpness: 0, resolution: 0, uncertainty: 0, murphyDecomposition: { reliability: 0, resolution: 0, uncertainty: 0 } },
    });
    expect(artifact.artifactId).toMatch(/^piart_\d{6}$/);
    expect(artifact.immutable).toBe(true);
  });
});

describe('EPIC 18.12 — ChampionCalibrationGate', () => {
  const gate = new ChampionCalibrationGate();

  it('passes when all calibration criteria are met', () => {
    const decision = gate.evaluate('champion', {
      ece: 0.03, mce: 0.05, ace: 0.04, brierScore: 0.15, logLoss: 0.35,
      negativeLogLikelihood: 35, calibrationLoss: 0.03, sharpness: 0.15,
      resolution: 0.05, uncertainty: 0.25,
      murphyDecomposition: { reliability: 0.03, resolution: 0.05, uncertainty: 0.25 },
    }, {
      maxEce: 0.05, maxMce: 0.1, minSharpness: 0.05, maxLogLoss: 0.5,
      maxCalibrationDrift: 0.1, requireCrossValidationSuccess: false,
      requireBucketStability: false, maxProbabilityDrift: 0.1,
    });
    expect(decision.passed).toBe(true);
    expect(decision.decisionReport).toContain('PASSED');
  });

  it('fails when ECE exceeds maximum', () => {
    const decision = gate.evaluate('champion', {
      ece: 0.15, mce: 0.2, ace: 0.12, brierScore: 0.3, logLoss: 0.7,
      negativeLogLikelihood: 70, calibrationLoss: 0.15, sharpness: 0.02,
      resolution: 0.01, uncertainty: 0.25,
      murphyDecomposition: { reliability: 0.15, resolution: 0.01, uncertainty: 0.25 },
    }, {
      maxEce: 0.05, maxMce: 0.1, minSharpness: 0.05, maxLogLoss: 0.5,
      maxCalibrationDrift: 0.1, requireCrossValidationSuccess: false,
      requireBucketStability: false, maxProbabilityDrift: 0.1,
    });
    expect(decision.passed).toBe(false);
    expect(decision.gates[0].passed).toBe(false);
  });
});