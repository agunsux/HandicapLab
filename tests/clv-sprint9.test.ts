import { describe, it, expect } from 'vitest';
import { CLVCalculator } from '../src/lib/settlement/clv-calculator';
import { MarketTruthScanner } from '../src/lib/validation/market-truth';

describe('Sprint 9: CLV & Market Truth Layer', () => {
  describe('CLV Calculation with Expectation Movement', () => {
    it('should calculate standard price-based CLV for Moneyline', () => {
      // opening = 1.95, closing = 1.80
      // clv = (1.95 / 1.80) - 1.0 = +8.33%
      const res = CLVCalculator.calculateDetailed('ML', 'home', 0, 1.95, 0, 1.80);
      expect(res.total_clv).toBeCloseTo(0.0833, 4);
      expect(res.clv_category).toBe('Elite');
    });

    it('should calculate detailed CLV for Asian Handicap line and price shifts (positive CLV example)', () => {
      // Opening: Team A -0.25 @1.95. Expectation = -(-0.25)/1.95 = 0.1282
      // Closing: Team A -0.50 @1.87. Expectation = -(-0.5)/1.87 = 0.2674
      // total_clv = 0.2674 - 0.1282 = +0.1392
      const res = CLVCalculator.calculateDetailed('AH', 'home', -0.25, 1.95, -0.50, 1.87);
      
      expect(res.total_clv).toBeCloseTo(0.1392, 4);
      expect(res.line_clv).toBeCloseTo(0.1282, 4); // -(-0.5)/1.95 - 0.25/1.95 = 0.2564 - 0.1282 = 0.1282
      expect(res.price_clv).toBeCloseTo(0.0110, 4); // 0.2674 - 0.2564 = 0.0110
      expect(res.clv_category).toBe('Elite');
    });

    it('should calculate detailed CLV for Asian Handicap when selection is Away', () => {
      // Opening: Team B +0.25 @1.95 (represented as -0.25 line in bookmaker, but selection is away)
      const res = CLVCalculator.calculateDetailed('AH', 'away', -0.25, 1.95, -0.50, 1.87);
      
      // oExpectation = -0.25 / 1.95 = -0.1282
      // cExpectation = -0.5 / 1.87 = -0.2674
      // total_clv = -0.2674 - (-0.1282) = -0.1392
      expect(res.total_clv).toBeCloseTo(-0.1392, 4);
      expect(res.clv_category).toBe('Negative');
    });
  });

  describe('Market Truth & Data Quality Guards', () => {
    it('should reject signals with missing opening odds', () => {
      const res = MarketTruthScanner.evaluate({
        openingOdds: undefined,
        referenceBookmaker: 'PINNACLE',
        oddsTimestamp: new Date().toISOString(),
        kickoffUtc: new Date(Date.now() + 10000).toISOString()
      });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContain('missing opening odds');
    });

    it('should reject signals with invalid reference bookmaker', () => {
      const res = MarketTruthScanner.evaluate({
        openingOdds: 1.95,
        referenceBookmaker: 'BOVADA', // not PINNACLE, SHARP, or AVERAGE_MARKET
        oddsTimestamp: new Date().toISOString(),
        kickoffUtc: new Date(Date.now() + 10000).toISOString()
      });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContain('invalid reference bookmaker');
    });

    it('should reject signals if fixture already started', () => {
      const res = MarketTruthScanner.evaluate({
        openingOdds: 1.95,
        referenceBookmaker: 'PINNACLE',
        oddsTimestamp: new Date(Date.now() - 130000).toISOString(),
        kickoffUtc: new Date(Date.now() - 120000).toISOString() // started 2 minutes ago
      });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContain('fixture started');
    });

    it('should compute derived Market Truth Score correctly', () => {
      const res = MarketTruthScanner.evaluate({
        openingOdds: 1.95,
        referenceBookmaker: 'PINNACLE',
        oddsTimestamp: new Date().toISOString(),
        kickoffUtc: new Date(Date.now() + 10000).toISOString(), // close to kickoff -> fresh
        liquidityScore: 90,
        lineMovementQuality: 85
      });
      expect(res.isValid).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(70);
      expect(res.category).toBe('excellent');
    });
  });
});
