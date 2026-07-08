import { describe, it, expect } from 'vitest';
import { DataQualityScorer } from '../src/lib/uncertainty/DataQualityScorer';
import { EvidenceAgreement, EvidenceSource } from '../src/lib/uncertainty/EvidenceAgreement';
import { EnsembleAgreement } from '../src/lib/uncertainty/EnsembleAgreement';
import { DistributionShiftDetector } from '../src/lib/uncertainty/DistributionShiftDetector';
import { DecisionConfidenceEngine } from '../src/lib/decision/DecisionConfidenceEngine';
import { DecisionGate } from '../src/lib/decision/DecisionGate';
import { DecisionBacktester } from '../src/lib/benchmark/DecisionBacktester';

describe('Decision Confidence Engine (Module 2)', () => {
  it('should penalize poor data quality', () => {
    const score = DataQualityScorer.score(0.2, 48, 0.2); // 20% missing, 48 hrs old, low depth
    expect(score).toBeLessThan(0.6); // heavily penalized
  });

  it('should flag conflicting evidence as inconclusive', () => {
    const evidence: EvidenceSource[] = [
      { name: 'Community', signal: 'FRAUD', confidence: 0.9 },
      { name: 'Government', signal: 'SAFE', confidence: 0.9 }
    ];
    const { agreementScore, isConflicting, conflictingSources } = EvidenceAgreement.evaluate(evidence);
    expect(isConflicting).toBe(true);
    expect(agreementScore).toBe(0.2);
    expect(conflictingSources).toContain('Community');
    expect(conflictingSources).toContain('Government');
  });

  it('should reduce agreement score for high variance ensemble', () => {
    const predictions = [
      { engineName: 'Poisson', probability: 0.9 },
      { engineName: 'XGBoost', probability: 0.1 }
    ];
    const { variance, agreementScore } = EnsembleAgreement.evaluate(predictions);
    expect(variance).toBeGreaterThan(0.1);
    expect(agreementScore).toBeLessThan(0.5);
  });

  it('should generate a NO_BET decision if confidence is low', () => {
    const vector = {
      epistemic: 0.8,
      data_quality: 0.5, // Poor data quality
      distribution_shift: 0.9,
      evidence_agreement: 1.0
    };
    
    const confidence = DecisionConfidenceEngine.calculate(vector);
    expect(confidence).toBeLessThan(0.7);

    const decisionObj = DecisionGate.evaluate(0.6, 0.1, confidence, vector);
    expect(decisionObj.decision).toBe('NO_BET');
    expect(decisionObj.blocking_flags).toContain('POOR_DATA_QUALITY');
    expect(decisionObj.blocking_flags).toContain('LOW_CONFIDENCE');
  });

  it('should generate an INCONCLUSIVE decision for conflicting evidence', () => {
    const vector = { evidence_agreement: 0.2 }; // Set directly to simulate conflict
    const confidence = DecisionConfidenceEngine.calculate(vector);
    const decisionObj = DecisionGate.evaluate(0.8, 0.1, confidence, vector);
    
    expect(decisionObj.decision).toBe('INCONCLUSIVE');
    expect(decisionObj.blocking_flags).toContain('CONFLICTING_EVIDENCE');
  });

  it('should correctly calculate decision accuracy metrics in backtest', () => {
    const mockDecisionObj = (dec: 'BET' | 'NO_BET') => ({
      decision_version: 'v1' as const,
      uncertainty_vector: {},
      decision: dec,
      reasoning: [],
      blocking_flags: []
    });

    const records = [
      { decision: mockDecisionObj('BET'), actualOutcomeIsPositive: true },   // Correct Bet
      { decision: mockDecisionObj('BET'), actualOutcomeIsPositive: false },  // False Bet
      { decision: mockDecisionObj('NO_BET'), actualOutcomeIsPositive: false }, // Correct Skip
      { decision: mockDecisionObj('NO_BET'), actualOutcomeIsPositive: true },  // Missed Opportunity
    ];

    const metrics = DecisionBacktester.evaluate(records);
    expect(metrics.correctBet).toBe(1);
    expect(metrics.falseBet).toBe(1);
    expect(metrics.correctSkip).toBe(1);
    expect(metrics.missedOpportunity).toBe(1);
    expect(metrics.accuracy).toBe(0.5); // 2 correct out of 4
  });
});
