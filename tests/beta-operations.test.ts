import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_PLANS, getPlan } from '../src/lib/config/pricing';

describe('Sprint 10: Beta Operations & Monetization Config', () => {
  describe('Subscription Plans', () => {
    it('should correctly configure Free, Starter, Pro, and Quant tiers', () => {
      expect(SUBSCRIPTION_PLANS.length).toBeGreaterThanOrEqual(4);

      const freePlan = getPlan('free');
      expect(freePlan).not.toBeNull();
      expect(freePlan?.price).toBe(0);

      const proPlan = getPlan('pro');
      expect(proPlan).not.toBeNull();
      expect(proPlan?.price).toBe(29);
      expect(proPlan?.billing_cycle).toBe('monthly');
    });

    it('should support one-time lifetime pass config', () => {
      const pass = getPlan('beta_one_time');
      expect(pass).not.toBeNull();
      expect(pass?.price).toBe(149);
      expect(pass?.billing_cycle).toBe('one-time');
    });
  });

  describe('Sample Confidence Score Math', () => {
    it('should evaluate categories correctly based on hypothetical parameters', () => {
      const getConfidenceScoreAndCategory = (totalBets: number, beatClosingRate: number, maxDrawdownPercent: number) => {
        const sampleSizeWeight = Math.min(1.0, totalBets / 500) * 40;
        const clvConsistencyWeight = Math.min(1.0, beatClosingRate / 60) * 30;
        const roiStabilityWeight = Math.max(0, 1.0 - (maxDrawdownPercent / 100)) * 30;
        const score = Number((sampleSizeWeight + clvConsistencyWeight + roiStabilityWeight).toFixed(1));

        let category = 'insufficient data';
        if (score >= 85) category = 'validated';
        else if (score >= 70) category = 'strong';
        else if (score >= 40) category = 'developing';

        return { score, category };
      };

      // Case 1: Insufficient bets
      const res1 = getConfidenceScoreAndCategory(20, 30, 40); // 40% drawdown
      expect(res1.score).toBeLessThan(40);
      expect(res1.category).toBe('insufficient data');

      // Case 2: Developing validation dataset
      const res2 = getConfidenceScoreAndCategory(150, 45, 10);
      // size = 150/500 * 40 = 12
      // clv = 45/60 * 30 = 22.5
      // drawdown = 0.9 * 30 = 27
      // total = 12 + 22.5 + 27 = 61.5
      expect(res2.score).toBeCloseTo(61.5, 1);
      expect(res2.category).toBe('developing');

      // Case 3: Fully validated dataset
      const res3 = getConfidenceScoreAndCategory(600, 65, 5);
      // size = 40
      // clv = 30
      // drawdown = 0.95 * 30 = 28.5
      // total = 98.5
      expect(res3.score).toBeCloseTo(98.5, 1);
      expect(res3.category).toBe('validated');
    });
  });
});
