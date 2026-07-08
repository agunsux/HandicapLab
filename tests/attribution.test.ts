import { describe, it, expect, beforeEach } from 'vitest';
import { AttributionEngine } from '../src/lib/attribution/AttributionEngine';
import { DriverRegistry } from '../src/lib/attribution/DriverRegistry';
import { OutcomeAttribution } from '../src/lib/attribution/OutcomeAttribution';
import { InteractionEngine } from '../src/lib/attribution/InteractionEngine';
import { DecisionObject } from '../src/lib/decision/DecisionObject';
import { ExplanationObject } from '../src/lib/explainability/types';

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
      data_quality: 0.9, // inverted -> 0.1 uncertainty
      distribution_shift: 0.95
    },
    decision: 'BET',
    risk_level: 'LOW',
    reasoning: ['All decision gates passed successfully.'],
    blocking_flags: [],
    ...overrides
  };
}

function makeExplanationObject(): ExplanationObject {
  return {
    decisionId: 'test-decision',
    decisionSchemaVersion: 'v1',
    explanationVersion: 'v1.0',
    builderVersion: '1.0.0',
    generatedAt: new Date(),
    completenessScore: 100,
    narrative: {
      summary: '',
      decisionReason: '',
      confidenceReason: '',
      uncertaintyReason: '',
      evidenceSummary: ''
    },
    structured: {
      recommendation: { decision: 'BET', riskLevel: 'LOW', confidence: 0.82, isBlocked: false },
      dominantSignals: [],
      dominantRisks: [],
      uncertaintyFactors: [],
      featureContributions: {
        status: 'AVAILABLE',
        factors: [
          { name: 'home_attacking_pressure', contribution: 0.6, direction: 'POSITIVE', confidence: 0.9 },
          { name: 'market_underreaction', contribution: 0.4, direction: 'POSITIVE', confidence: 0.8 },
          { name: 'travel_fatigue', contribution: 0.2, direction: 'NEGATIVE', confidence: 0.7 }
        ]
      },
      evidenceAgreement: {
        agreementLevel: 'VERY_HIGH', agreementScore: 1.0, consensusDecision: 'BET',
        conflictingModules: [], sources: []
      }
    }
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Module 5: Decision Attribution & Causal Analysis', () => {

  beforeEach(() => {
    DriverRegistry._clear();
    DriverRegistry._seedMockData(); // Seeds home_attacking_pressure, market_underreaction, etc.
  });

  describe('Interaction Engine', () => {
    it('detects deterministic interaction rules (synergy)', () => {
      // rule_momentum_fatigue_synergy looks for home_attacking_pressure & travel_fatigue
      const contributions: any[] = [
        { name: 'home_attacking_pressure', direction: 'POSITIVE', normalizedContribution: 0.6 },
        { name: 'travel_fatigue', direction: 'NEGATIVE', normalizedContribution: 0.2 }
      ];

      const interactions = InteractionEngine.detectInteractions(contributions);
      expect(interactions.length).toBe(1);
      expect(interactions[0].effectName).toBe('Momentum + Travel Fatigue Synergy');
      expect(interactions[0].multiplier).toBe(1.2);
    });

    it('detects counteracting factors', () => {
      const contributions: any[] = [
        { name: 'factor_A', direction: 'POSITIVE', normalizedContribution: 0.6 },
        { name: 'factor_B', direction: 'NEGATIVE', normalizedContribution: 0.4 }
      ];

      const counter = InteractionEngine.detectCounteracting(contributions);
      expect(counter.length).toBe(1);
      expect(counter[0].netImpact).toBeCloseTo(0.2);
      expect(counter[0].netDirection).toBe('POSITIVE');
    });
  });

  describe('Attribution Engine (Draft / Phase 1)', () => {
    it('is 100% deterministic for identical inputs', () => {
      const decision = makeDecisionObject();
      const expl = makeExplanationObject();
      
      const run1 = AttributionEngine.buildDraft({ decisionId: 'uuid', decisionObject: decision, explanationObject: expl });
      const run2 = AttributionEngine.buildDraft({ decisionId: 'uuid', decisionObject: decision, explanationObject: expl });

      const { generatedAt: t1, ...obj1 } = run1;
      const { generatedAt: t2, ...obj2 } = run2;

      expect(obj1).toEqual(obj2);
    });

    it('generates a consistent Decision DNA fingerprint', () => {
      const decision = makeDecisionObject();
      const expl = makeExplanationObject();
      
      const attribution = AttributionEngine.buildDraft({ decisionId: 'dna-test', decisionObject: decision, explanationObject: expl });
      
      expect(attribution.decisionDNA.fingerprint).toBeDefined();
      expect(Object.keys(attribution.decisionDNA.topDrivers)).toContain('home_attacking_pressure');
      expect(attribution.decisionDNA.confidence).toBe(0.82);
    });

    it('looks up DriverIntelligence stats for dominant drivers', () => {
      const decision = makeDecisionObject();
      const expl = makeExplanationObject();
      
      const attribution = AttributionEngine.buildDraft({ decisionId: 'uuid', decisionObject: decision, explanationObject: expl });
      
      // home_attacking_pressure is seeded with reliabilityScore 92
      const topDriver = attribution.dominantDrivers.find(d => d.name === 'home_attacking_pressure');
      expect(topDriver).toBeDefined();
      expect(topDriver?.reliabilityScore).toBe(92);
    });

    it('builds a causal graph linking features to decision', () => {
      const decision = makeDecisionObject();
      const expl = makeExplanationObject();
      
      const attribution = AttributionEngine.buildDraft({ decisionId: 'uuid', decisionObject: decision, explanationObject: expl });
      
      const graph = attribution.causalGraph;
      
      // Should have the final decision node
      expect(graph.nodes.find(n => n.id === 'DECISION_FINAL')).toBeDefined();
      // Should have feature nodes
      expect(graph.nodes.find(n => n.id === 'NODE_home_attacking_pressure')).toBeDefined();
      // Should have edge from feature to decision
      const edge = graph.edges.find(e => e.from === 'NODE_home_attacking_pressure' && e.to === 'DECISION_FINAL');
      expect(edge).toBeDefined();
      expect(edge?.relation).toBe('INCREASES');
    });
  });

  describe('Outcome Attribution (Post-Settlement / Phase 2)', () => {
    it('evaluates drivers correctly on BET_WON', () => {
      const decision = makeDecisionObject();
      const expl = makeExplanationObject();
      const draft = AttributionEngine.buildDraft({ decisionId: 'uuid', decisionObject: decision, explanationObject: expl });
      
      const outcome = OutcomeAttribution.evaluateOutcome(draft, 'BET_WON', 1.5);
      
      expect(outcome.phase).toBe('POST_SETTLEMENT');
      expect(outcome.decisionDNA.outcome).toBe('BET_WON');
      
      const homePressureOutcome = outcome.outcomeContribution?.find(c => c.driverName === 'home_attacking_pressure');
      expect(homePressureOutcome?.actualOutcomeAlignment).toBe('CORRECT');
      expect(homePressureOutcome?.valueDelivered).toBeGreaterThan(0);
      
      const travelFatigueOutcome = outcome.outcomeContribution?.find(c => c.driverName === 'travel_fatigue');
      // travel_fatigue was a suppressor (negative direction). Since bet won, the suppressor was INCORRECT.
      expect(travelFatigueOutcome?.actualOutcomeAlignment).toBe('INCORRECT');
      expect(travelFatigueOutcome?.valueDelivered).toBeLessThan(0);
    });
  });
});
