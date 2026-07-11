/**
 * EPIC 20 — Decision Intelligence Platform Tests
 */

import { describe, it, expect } from 'vitest';
import { DECISION_INTELLIGENCE_VERSION } from '../src/lib/decision-intelligence/types';
import { PolicyRegistry } from '../src/lib/decision-intelligence/policies';
import { DecisionPipeline } from '../src/lib/decision-intelligence/decisionPipeline';
import { EVLaboratory } from '../src/lib/decision-intelligence/evLaboratory';
import { RiskEngine } from '../src/lib/decision-intelligence/riskEngine';
import { PortfolioOptimizer } from '../src/lib/decision-intelligence/portfolioOptimizer';
import { ConsistencyEngine } from '../src/lib/decision-intelligence/consistencyEngine';
import { AttributionEngine } from '../src/lib/decision-intelligence/attributionEngine';
import { DecisionArtifactIntegration } from '../src/lib/decision-intelligence/artifactIntegration';
import { ChampionDecisionGate } from '../src/lib/decision-intelligence/championDecisionGate';
import { DecisionReportGenerator } from '../src/lib/decision-intelligence/reporting';
import type { DecisionInput } from '../src/lib/decision-intelligence/types';

describe('Constants', () => {
  it('exports correct version', () => {
    expect(DECISION_INTELLIGENCE_VERSION).toBe('1.0.0');
  });
});

describe('EPIC 20.1 — PolicyRegistry', () => {
  it('registers 8 default policies', () => {
    const registry = new PolicyRegistry();
    expect(registry.getAll().length).toBe(8);
    expect(registry.get('conservative')).toBeDefined();
    expect(registry.get('balanced')).toBeDefined();
    expect(registry.get('aggressive')).toBeDefined();
  });

  it('registers custom policy via override', () => {
    const registry = new PolicyRegistry();
    const custom = { policyId: 'conservative' as const, version: '2.0.0', description: 'Custom', minEdge: 0.1, minConfidence: 0.9, maxRiskPerBet: 0.01, marketRestrictions: ['ML' as const], stakeSizingMethod: 'flat' as const, portfolioRules: [], maxPortfolioExposure: 0.1, maxConcurrentBets: 2 };
    registry.register(custom);
    expect(registry.get('conservative')?.version).toBe('2.0.0');
  });
});

describe('EPIC 20.2 — DecisionPipeline', () => {
  const makeInput = (overrides: Partial<DecisionInput> = {}): DecisionInput => ({
    fixtureId: 'm1', market: 'ML', rawProbability: 0.5, calibratedProbability: 0.55,
    confidence: 0.7, homeOdds: 2.0, drawOdds: 3.4, awayOdds: 3.8,
    featureContributions: { elo: 0.3 }, bankroll: 1000, currentExposure: 0,
    ...overrides,
  });

  it('returns recommendation with explanation', () => {
    const pipeline = new DecisionPipeline();
    const result = pipeline.execute(makeInput(), 'balanced');
    expect(result.explanation.fixtureId).toBe('m1');
    expect(typeof result.explanation.recommended).toBe('boolean');
    expect(result.explanation.decisionReason).toBeTruthy();
    expect(result.stages.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects when confidence too low', () => {
    const pipeline = new DecisionPipeline();
    const result = pipeline.execute(makeInput({ confidence: 0.1 }), 'balanced');
    expect(result.explanation.recommended).toBe(false);
  });

  it('rejects when EV too low', () => {
    const pipeline = new DecisionPipeline();
    const result = pipeline.execute(makeInput({ calibratedProbability: 0.4, homeOdds: 1.5 }), 'balanced');
    expect(result.explanation.recommended).toBe(false);
  });
});

describe('EPIC 20.3 — EVLaboratory', () => {
  const lab = new EVLaboratory();

  it('computes complete EV analysis', () => {
    const ev = lab.compute({ fixtureId: 'm1', market: 'ML', rawProbability: 0.5, calibratedProbability: 0.55, homeOdds: 2.0, drawOdds: null, awayOdds: 3.8 });
    expect(ev.expectedValue).toBeCloseTo(0.1, 5);
    expect(ev.fairOdds).toBeCloseTo(1.82, 1);
    expect(ev.breakEvenProbability).toBeCloseTo(0.5, 2);
    expect(ev.valueMargin).toBeGreaterThan(0);
  });
});

describe('EPIC 20.5 — RiskEngine', () => {
  const engine = new RiskEngine();

  it('assesses portfolio risk', () => {
    const profile = engine.assess([
      { market: 'ML', league: 'EPL', stake: 20, odds: 2.0 },
      { market: 'ML', league: 'EPL', stake: 15, odds: 1.8 },
    ], 1000);
    expect(profile.portfolioExposure).toBeCloseTo(0.035, 3);
    expect(profile.valueAtRisk).toBeGreaterThan(0);
    expect(profile.conditionalVaR).toBeGreaterThan(0);
  });
});

describe('EPIC 20.6 — PortfolioOptimizer', () => {
  it('allocates stake respecting constraints', () => {
    const opt = new PortfolioOptimizer();
    const alloc = opt.allocate(
      [
        { fixtureId: 'm1', expectedValue: 0.1, stake: 50, market: 'ML' },
        { fixtureId: 'm2', expectedValue: 0.05, stake: 30, market: 'AH' },
      ],
      { maxExposure: 0.1, maxMarketExposure: 0.05, maxLeagueExposure: 0.05, maxDailyBets: 10, maxDailyStake: 100 },
      1000
    );
    expect(alloc.length).toBeGreaterThan(0);
  });
});

describe('EPIC 20.8 — ConsistencyEngine', () => {
  it('analyzes decision consistency', () => {
    const engine = new ConsistencyEngine();
    const results = engine.analyze([
      { policyId: 'balanced', recommended: true, expectedValue: 0.05, stakeSize: 20 },
      { policyId: 'balanced', recommended: true, expectedValue: 0.08, stakeSize: 25 },
      { policyId: 'balanced', recommended: false, expectedValue: -0.02, stakeSize: 0 },
    ]);
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some((r) => r.dimension === 'policy_drift')).toBe(true);
  });
});

describe('EPIC 20.9 — AttributionEngine', () => {
  it('attributes performance to factors', () => {
    const engine = new AttributionEngine();
    const report = engine.attribute([
      { factor: 'probability', contribution: 50 },
      { factor: 'calibration', contribution: 30 },
      { factor: 'stake', contribution: 20 },
    ]);
    expect(report.results.length).toBe(3);
    expect(report.results.reduce((s, r) => s + r.pct, 0)).toBeCloseTo(100, 0);
  });
});

describe('EPIC 20.10 — DecisionArtifactIntegration', () => {
  it('creates immutable artifacts', () => {
    const integration = new DecisionArtifactIntegration();
    const artifact = integration.create({ datasetId: 'ds_1', experimentId: 'exp_1', modelVersion: '1.0.0', decisionExplanation: { fixtureId: 'm1', recommended: true, rawProbability: 0.5, calibratedProbability: 0.55, expectedValue: 0.1, confidence: 0.8, featureContribution: { elo: 0.3 }, riskScore: 0.2, stakeSize: 20, policyApplied: 'balanced', decisionReason: 'EV 10%', rejectedAlternatives: [], evidenceLinks: [] } });
    expect(artifact.artifactId).toMatch(/^diart_\d{6}$/);
    expect(artifact.immutable).toBe(true);
  });
});

describe('EPIC 20.12 — ChampionDecisionGate', () => {
  const gate = new ChampionDecisionGate();

  it('passes when all criteria met', () => {
    const decision = gate.evaluate('champion', {
      minExpectedValue: 0.02, minDecisionConsistency: 70, minStakeStability: 60, maxPortfolioRisk: 0.5,
      requireCalibrationPass: true, requireFeatureValidation: false, requireReplayValidation: false, requireBaselineComparison: false,
    }, { meanExpectedValue: 0.05, consistencyScore: 85, stakeStabilityScore: 80, portfolioRisk: 0.3, calibrationPassed: true });
    expect(decision.passed).toBe(true);
    expect(decision.decisionReport).toContain('PASSED');
  });

  it('fails when EV below threshold', () => {
    const decision = gate.evaluate('champion', {
      minExpectedValue: 0.05, minDecisionConsistency: 50, minStakeStability: 50, maxPortfolioRisk: 0.5,
      requireCalibrationPass: false, requireFeatureValidation: false, requireReplayValidation: false, requireBaselineComparison: false,
    }, { meanExpectedValue: 0.01, consistencyScore: 85, stakeStabilityScore: 80, portfolioRisk: 0.3 });
    expect(decision.passed).toBe(false);
  });
});

describe('EPIC 20.11 — DecisionReportGenerator', () => {
  it('generates markdown reports', () => {
    const gen = new DecisionReportGenerator();
    const report = gen.generate({ type: 'decision', summary: '5 decisions processed', data: {} });
    expect(report.reportId).toMatch(/^direp_\d{6}$/);
    const md = gen.toMarkdown(report);
    expect(md).toContain('# Decision Report');
  });
});