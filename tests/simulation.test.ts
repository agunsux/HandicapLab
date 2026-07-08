import { describe, it, expect } from 'vitest';
import { CounterfactualEngine } from '../src/lib/simulation/CounterfactualEngine';
import { PromotionScorer } from '../src/lib/simulation/PromotionScorer';
import { ExperimentCardBuilder } from '../src/lib/simulation/ExperimentCardBuilder';
import { ResearchLedger } from '../src/lib/simulation/ResearchLedger';
import { DecisionObject } from '../src/lib/decision/DecisionObject';
import { Experiment, SimulationMetrics } from '../src/lib/simulation/types';

function makeDecisionObject(): DecisionObject {
  return {
    decision_version: 'v1',
    probability: 0.65,
    expected_value: 0.08,
    confidence: 0.82,
    decision: 'BET',
    risk_level: 'LOW',
    blocking_flags: [],
    reasoning: [],
    uncertainty_vector: { epistemic: 0.1 }
  };
}

describe('Module 6: Decision Research & Simulation Platform', () => {
  
  describe('CounterfactualEngine', () => {
    it('applies threshold override (BET -> NO_BET)', () => {
      const decision = makeDecisionObject(); // confidence is 0.82
      
      const modified = CounterfactualEngine.applyProxy(decision, {
        thresholdAdjustments: { 'decisionThreshold': 0.85 }
      });
      
      expect(modified.decision).toBe('NO_BET');
      expect(modified.blocking_flags).toContain('LOW_CONFIDENCE');
    });

    it('applies confidence adjustments', () => {
      const decision = makeDecisionObject(); 
      const modified = CounterfactualEngine.applyProxy(decision, {
        confidenceAdjustment: -0.05
      });
      expect(modified.confidence).toBeCloseTo(0.77);
    });
  });

  describe('PromotionScorer', () => {
    it('calculates promotion score incorporating evidence level', () => {
      const base: SimulationMetrics = {
        yield: 0.05, coverage: 0.5, correctSkips: 10, missedOpportunities: 5,
        hitRate: 0.55, decisionQuality: 80, expectedUtility: 5.0, calibration: 0.9, confidenceDrift: 0
      };
      const cand: SimulationMetrics = {
        ...base,
        yield: 0.07, // Yield improved by +0.02 -> utility +20
        coverage: 0.5, // Coverage stable
        correctSkips: 15, // Skips improved
        missedOpportunities: 4 // Missed decreased
      };

      const l1Result = PromotionScorer.score(base, cand, 'L1'); // L1 caps score (multiplier 0.6)
      const l2Result = PromotionScorer.score(base, cand, 'L2'); // L2 full score (multiplier 1.0)

      expect(l2Result.compositeScore).toBeGreaterThan(l1Result.compositeScore);
      expect(l2Result.compositeScore).toBe(69); // 69 is correct based on math
    });

    it('penalizes massive coverage drops', () => {
      const base: SimulationMetrics = {
        yield: 0.05, coverage: 0.5, correctSkips: 10, missedOpportunities: 5,
        hitRate: 0.55, decisionQuality: 80, expectedUtility: 5.0, calibration: 0.9, confidenceDrift: 0
      };
      // Candidate artificially boosts yield but destroys coverage
      const cand: SimulationMetrics = {
        ...base,
        yield: 0.10, 
        coverage: 0.1 // Dropped severely
      };

      const res = PromotionScorer.score(base, cand, 'L2');
      expect(res.details.coverageScore).toBe(20); // Penalized
    });
  });

  describe('ExperimentCardBuilder', () => {
    it('formats delta metrics for human readability', () => {
      const base: SimulationMetrics = {
        yield: 0.05, coverage: 0.5, correctSkips: 10, missedOpportunities: 5,
        hitRate: 0.55, decisionQuality: 80, expectedUtility: 5.0, calibration: 0.9, confidenceDrift: 0
      };
      const cand: SimulationMetrics = {
        ...base, yield: 0.07, correctSkips: 15, missedOpportunities: 4
      };

      const exp: Experiment = {
        id: 'exp1', name: 'Threshold Test', status: 'COMPLETED', configuration: {},
        datasetQuery: 'all', executionMode: 'PROXY', evidenceLevel: 'L1',
        baselineMetrics: base, candidateMetrics: cand, createdAt: new Date()
      };

      const card = ExperimentCardBuilder.build(exp);
      const yieldDelta = card.deltas.find(d => d.metric === 'Yield');
      const missDelta = card.deltas.find(d => d.metric === 'Missed Opportunities');

      expect(yieldDelta?.formattedDiff).toBe('+2.0%');
      expect(missDelta?.formattedDiff).toBe('-1'); // not percentage
      expect(missDelta?.isPositive).toBe(true); // lower misses is positive
    });
  });

  describe('ResearchLedger', () => {
    it('stores experiments immutably, generating new versions for conflicts', () => {
      ResearchLedger._clear();
      
      const exp: Experiment = {
        id: 'test-exp', name: 'Test', status: 'COMPLETED', configuration: {},
        datasetQuery: 'all', executionMode: 'PROXY', evidenceLevel: 'L1',
        createdAt: new Date()
      };

      const id1 = ResearchLedger.commit(exp);
      const id2 = ResearchLedger.commit(exp); // Should not overwrite

      expect(id1).toBe('test-exp');
      expect(id2).toContain('test-exp-v');
      expect(id1).not.toBe(id2);
    });
  });
});
