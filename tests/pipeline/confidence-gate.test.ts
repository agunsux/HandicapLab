import { describe, it, expect } from 'vitest';
import { ConfidenceGateSystem, ConfidenceGateInput } from '@/lib/pipeline/confidenceGate';

describe('Epic: Daily Prediction & Confidence Gate System', () => {
  const baseKickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const basePredictionTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const baseOddsTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const validAhInput: ConfidenceGateInput = {
    canonicalMatchId: 'EPL_2025_ARSENAL_CHELSEA_2026-09-28',
    fixtureId: 'fix_101',
    match: 'Arsenal vs Chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    kickoffUtc: baseKickoff,
    market: 'AH',
    selection: 'Arsenal -0.5',
    line: -0.5,
    odds: 1.85,
    modelProbability: 0.68,
    calibratedProbability: 0.68,
    predictionTimestampUtc: basePredictionTime,
    oddsTimestampUtc: baseOddsTime,
    modelVersion: 'dixon-coles-v1.0',
    sampleSizeHome: 10,
    sampleSizeAway: 10,
    modelValidated: true,
  };

  // ─── 1. PROBABILITY GATE: STRICTLY > 65% ────────────────────────────────
  describe('1. Probability Gate (Calibrated Probability > 65%)', () => {
    it('accepts prediction with calibrated probability > 65%', () => {
      const result = ConfidenceGateSystem.evaluate(validAhInput);
      expect(result.passes.probabilityThreshold).toBe(true);
      expect(result.calibratedProbability).toBe(0.68);
      expect(result.isHighConfidence).toBe(true);
      expect(result.status).toBe('HIGH_CONFIDENCE');
      expect(result.confidenceTier).toBe('HIGH');
    });

    it('rejects prediction with probability exactly 65.0% or lower', () => {
      const input65: ConfidenceGateInput = {
        ...validAhInput,
        modelProbability: 0.65,
        calibratedProbability: 0.65,
      };
      const result = ConfidenceGateSystem.evaluate(input65);
      expect(result.passes.probabilityThreshold).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.status).not.toBe('HIGH_CONFIDENCE');
      expect(result.rejectionReasons.some((r) => r.includes('PROBABILITY_BELOW_GATE'))).toBe(true);
    });

    it('rejects prediction with probability 64.9%', () => {
      const input649: ConfidenceGateInput = {
        ...validAhInput,
        modelProbability: 0.649,
        calibratedProbability: 0.649,
      };
      const result = ConfidenceGateSystem.evaluate(input649);
      expect(result.passes.probabilityThreshold).toBe(false);
      expect(result.isHighConfidence).toBe(false);
    });
  });

  // ─── 2. ODDS GATE: STRICTLY >= 1.60 ─────────────────────────────────────
  describe('2. Odds Gate (Odds >= 1.60)', () => {
    it('accepts odds >= 1.60', () => {
      const input160: ConfidenceGateInput = {
        ...validAhInput,
        odds: 1.60,
      };
      const result = ConfidenceGateSystem.evaluate(input160);
      expect(result.passes.oddsThreshold).toBe(true);
      expect(result.isHighConfidence).toBe(true);
    });

    it('rejects odds 1.59 from High Confidence', () => {
      const input159: ConfidenceGateInput = {
        ...validAhInput,
        odds: 1.59,
      };
      const result = ConfidenceGateSystem.evaluate(input159);
      expect(result.passes.oddsThreshold).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('ODDS_BELOW_GATE'))).toBe(true);
    });
  });

  // ─── 3. VALUE GATE & IMPLIED PROBABILITY ────────────────────────────────
  describe('3. Value Gate & Mathematical Implied Probability', () => {
    it('calculates implied probability, edge, and EV accurately', () => {
      const input: ConfidenceGateInput = {
        ...validAhInput,
        odds: 2.0,
        calibratedProbability: 0.68,
      };
      const result = ConfidenceGateSystem.evaluate(input);
      expect(result.marketImpliedProbability).toBe(0.5);
      expect(result.edge).toBe(0.18);
      expect(result.expectedValue).toBe(0.36);
      expect(result.passes.positiveEdge).toBe(true);
      expect(result.passes.positiveEv).toBe(true);
    });

    it('rejects pick when model has negative edge against market implied probability', () => {
      const inputNegativeEdge: ConfidenceGateInput = {
        ...validAhInput,
        odds: 1.40,
        calibratedProbability: 0.66,
      };
      const result = ConfidenceGateSystem.evaluate(inputNegativeEdge);
      expect(result.passes.positiveEdge).toBe(false);
      expect(result.passes.positiveEv).toBe(false);
      expect(result.isHighConfidence).toBe(false);
    });
  });

  // ─── 4. BTTS INVARIANT: STRICTLY RESEARCH_ONLY ──────────────────────────
  describe('4. BTTS Mandatory Rule: Always RESEARCH_ONLY', () => {
    it('forces BTTS to RESEARCH_ONLY even when probability is 75% and odds 1.80', () => {
      const bttsHighProbInput: ConfidenceGateInput = {
        ...validAhInput,
        market: 'BTTS',
        selection: 'Both Teams To Score: Yes',
        line: 0,
        odds: 1.80,
        modelProbability: 0.75,
        calibratedProbability: 0.75,
      };

      const result = ConfidenceGateSystem.evaluate(bttsHighProbInput);

      expect(result.status).toBe('RESEARCH_ONLY');
      expect(result.confidenceTier).toBe('PASS');
      expect(result.verdict).toBe('RESEARCH_ONLY');
      expect(result.qualified).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('BTTS_RESEARCH_ONLY'))).toBe(true);
    });
  });

  // ─── 5. TEMPORAL LEAKAGE INVARIANT ──────────────────────────────────────
  describe('5. Temporal Anti-Leakage Invariants', () => {
    it('rejects prediction timestamp that occurs at or after kickoff', () => {
      const futurePredInput: ConfidenceGateInput = {
        ...validAhInput,
        predictionTimestampUtc: new Date(new Date(baseKickoff).getTime() + 1000).toISOString(),
      };
      const result = ConfidenceGateSystem.evaluate(futurePredInput);
      expect(result.passes.temporalSanity).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.status).toBe('INVALID');
    });

    it('rejects odds timestamp that occurs after prediction timestamp', () => {
      const futureOddsInput: ConfidenceGateInput = {
        ...validAhInput,
        oddsTimestampUtc: new Date(new Date(basePredictionTime).getTime() + 5000).toISOString(),
      };
      const result = ConfidenceGateSystem.evaluate(futureOddsInput);
      expect(result.passes.temporalSanity).toBe(false);
      expect(result.isHighConfidence).toBe(false);
    });
  });

  // ─── 6. SAMPLE SIZE GOVERNANCE ──────────────────────────────────────────
  describe('6. Historical Sample Size Sufficiency', () => {
    it('rejects high confidence qualification if home or away sample < 5', () => {
      const smallSampleInput: ConfidenceGateInput = {
        ...validAhInput,
        sampleSizeHome: 2,
        sampleSizeAway: 10,
      };
      const result = ConfidenceGateSystem.evaluate(smallSampleInput);
      expect(result.passes.sufficientSample).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.rejectionReasons.some((r) => r.includes('INSUFFICIENT_SAMPLE'))).toBe(true);
    });
  });

  // ─── 7. NO QUALIFIED PICK RESULT ────────────────────────────────────────
  describe('7. No Qualified Pick Condition', () => {
    it('correctly produces NO QUALIFIED PICK when criteria are not met rather than lowering standards', () => {
      const mediocreInput: ConfidenceGateInput = {
        ...validAhInput,
        modelProbability: 0.52,
        calibratedProbability: 0.52,
        odds: 1.90,
      };
      const result = ConfidenceGateSystem.evaluate(mediocreInput);
      expect(result.qualified).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.verdict).toBe('LEWATI');
      expect(result.status).toBe('PENDING');
    });
  });
});
