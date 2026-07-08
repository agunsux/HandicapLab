import { describe, it, expect, beforeEach } from 'vitest';
import { ExplanationBuilder } from '../src/lib/explainability/ExplanationBuilder';
import { FeatureContributionEngine } from '../src/lib/explainability/FeatureContributionEngine';
import { EvidenceSummaryBuilder } from '../src/lib/explainability/EvidenceSummaryBuilder';
import { ExplanationRegistry } from '../src/lib/explainability/ExplanationRegistry';
import { ExplanationFormatter } from '../src/lib/explainability/ExplanationFormatter';
import { DecisionObject } from '../src/lib/decision/DecisionObject';
import { ProbabilityObject } from '../src/lib/probability/ProbabilityObject';
import { HealthScoreBreakdown } from '../src/lib/monitoring/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDecisionObject(overrides: Partial<DecisionObject> = {}): DecisionObject {
  return {
    decision_version: 'v1',
    probability: 0.65,
    expected_value: 0.08,
    confidence: 0.82,
    uncertainty_vector: {
      epistemic: 0.2,
      aleatoric: 0.5,
      data_quality: 0.9,
      distribution_shift: 0.95
    },
    decision: 'BET',
    risk_level: 'LOW',
    reasoning: ['All decision gates passed successfully.'],
    blocking_flags: [],
    ...overrides
  };
}

function makeProbabilityObject(attr: Record<string, number> | null = null): ProbabilityObject {
  return {
    probability_version: 'v1',
    raw_probability: 0.60,
    calibrated_probability: 0.65,
    risk_flags: [],
    feature_attribution: attr ?? {
      'home_attacking_pressure': 0.8,
      'away_defense_rating': -0.4,
      'weather_impact': 0.1
    }
  };
}

function makeHealthScore(): HealthScoreBreakdown {
  return {
    score: 85,
    status: 'HEALTHY',
    components: {
      predictionQuality: 20,
      calibration: 18,
      decisionQuality: 18,
      dataQuality: 14,
      drift: 10,
      latency: 5,
      coverage: 0
    }
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Module 4: Decision Explainability Engine', () => {
  
  beforeEach(() => {
    ExplanationRegistry._clear();
  });

  describe('FeatureContributionEngine', () => {
    it('normalizes feature attribution to sum to 1.0 based on absolute values', () => {
      const prob = makeProbabilityObject({ 'A': 0.5, 'B': -0.3, 'C': 0.2 });
      const result = FeatureContributionEngine.build(prob);
      
      expect(result.status).toBe('AVAILABLE');
      expect(result.factors.length).toBe(3);
      
      // Total abs = 0.5 + 0.3 + 0.2 = 1.0
      // A = 0.5 (POS), B = 0.3 (NEG), C = 0.2 (POS)
      
      const factorA = result.factors.find(f => f.name === 'A');
      expect(factorA?.contribution).toBeCloseTo(0.5);
      expect(factorA?.direction).toBe('POSITIVE');

      const factorB = result.factors.find(f => f.name === 'B');
      expect(factorB?.contribution).toBeCloseTo(0.3);
      expect(factorB?.direction).toBe('NEGATIVE');
    });

    it('returns UNAVAILABLE status when probability object or feature attribution is missing', () => {
      const result1 = FeatureContributionEngine.build(undefined);
      expect(result1.status).toBe('UNAVAILABLE');
      expect(result1.reason).toBe('INSUFFICIENT_DATA');

      const prob = makeProbabilityObject();
      delete prob.feature_attribution;
      const result2 = FeatureContributionEngine.build(prob);
      expect(result2.status).toBe('UNAVAILABLE');
      expect(result2.reason).toBe('NOT_COMPUTED');
    });
  });

  describe('EvidenceSummaryBuilder', () => {
    it('builds summary and detects CONFLICTING signals correctly', () => {
      const sources = [
        { engineName: 'Engine 1', signal: 'BET', confidence: 0.9 },
        { engineName: 'Engine 2', signal: 'NO_BET', confidence: 0.8 }
      ];

      const summary = EvidenceSummaryBuilder.buildSummary(sources);
      expect(summary.agreementLevel).toBe('CONFLICTING');
      expect(summary.agreementScore).toBeLessThan(0.5);
      expect(summary.conflictingModules).toContain('Engine 1');
      expect(summary.conflictingModules).toContain('Engine 2');
    });

    it('handles perfect alignment', () => {
      const sources = [
        { engineName: 'Engine 1', signal: 'BET', confidence: 0.9 },
        { engineName: 'Engine 2', signal: 'BET', confidence: 0.8 }
      ];
      const summary = EvidenceSummaryBuilder.buildSummary(sources);
      expect(summary.agreementLevel).toBe('VERY_HIGH');
      expect(summary.agreementScore).toBe(1.0);
    });
  });

  describe('ExplanationBuilder (Orchestrator)', () => {
    it('generates a 100% deterministic output for identical inputs', () => {
      const decision = makeDecisionObject();
      const prob = makeProbabilityObject();
      const health = makeHealthScore();

      const run1 = ExplanationBuilder.build({ decisionId: 'uuid-1', decisionObject: decision, probabilityObject: prob, healthScore: health });
      
      // Artificial delay (timestamp will differ, so we omit generatedAt from comparison)
      const run2 = ExplanationBuilder.build({ decisionId: 'uuid-1', decisionObject: decision, probabilityObject: prob, healthScore: health });

      const { generatedAt: t1, ...obj1 } = run1;
      const { generatedAt: t2, ...obj2 } = run2;

      expect(obj1).toEqual(obj2);
    });

    it('calculates CompletenessScore correctly', () => {
      const decision = makeDecisionObject();
      const prob = makeProbabilityObject();
      const health = makeHealthScore();
      
      const expl = ExplanationBuilder.build({ 
        decisionId: 'uuid-1', 
        decisionObject: decision, 
        probabilityObject: prob, 
        healthScore: health 
      });

      // All factors present, completeness should be 100
      expect(expl.completenessScore).toBe(100);
      expect(expl.structured.featureContributions.status).toBe('AVAILABLE');
    });

    it('calculates CompletenessScore correctly when feature contributions are missing', () => {
      const decision = makeDecisionObject();
      const prob = makeProbabilityObject({}); // Empty feature attribution
      const expl = ExplanationBuilder.build({ 
        decisionId: 'uuid-1', 
        decisionObject: decision,
        probabilityObject: prob
      });

      // Total checks = 6. One missing (feature contributions), so 5/6 = 83%
      expect(expl.completenessScore).toBe(83);
    });

    it('populates structured contributing and opposing factors', () => {
      const decision = makeDecisionObject({
        uncertainty_vector: { epistemic: 0.1, data_quality: 0.5 }
      });
      const health = makeHealthScore(); // calibration 18 -> POSITIVE
      
      const expl = ExplanationBuilder.build({ decisionId: 'test', decisionObject: decision, healthScore: health });
      
      expect(expl.structured.contributingFactors.find(f => f.name === 'epistemic_uncertainty')).toBeDefined();
      expect(expl.structured.contributingFactors.find(f => f.name === 'calibration_health')).toBeDefined();
      expect(expl.structured.opposingFactors.find(f => f.name === 'data_quality')).toBeDefined();
    });
  });

  describe('ExplanationFormatter', () => {
    it('formats as json, text, and markdown', () => {
      const decision = makeDecisionObject();
      const expl = ExplanationBuilder.build({ decisionId: 'test-uuid', decisionObject: decision });
      
      const json = ExplanationFormatter.format(expl, 'json');
      expect(json).toContain('"decisionId": "test-uuid"');
      
      const text = ExplanationFormatter.format(expl, 'text');
      expect(text).toContain('DECISION EXPLANATION: TEST-UUID');
      expect(text).toContain('--- 1. DECISION REASONING ---');
      
      const markdown = ExplanationFormatter.format(expl, 'markdown');
      expect(markdown).toContain('# Decision Explanation: test-uuid');
      expect(markdown).toContain('## 1. Decision Reasoning');
    });
  });

  describe('ExplanationRegistry', () => {
    it('saves and retrieves explanations', () => {
      const decision = makeDecisionObject();
      const expl = ExplanationBuilder.build({ decisionId: 'store-test', decisionObject: decision });
      
      ExplanationRegistry.save(expl);
      const retrieved = ExplanationRegistry.get('store-test');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.decisionId).toBe('store-test');
    });
  });
});
