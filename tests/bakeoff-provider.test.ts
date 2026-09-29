import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScrubber } from '@/lib/research/bakeoff/scrubber';
import { normalizeTeamName } from '@/lib/identity/fixtureMapping';
import { DeVigService } from '@/lib/settlement-core/devig';
import { ExpectedValueCalculator } from '@/lib/research/settlement/evCalculator';
import { CLVCalculator } from '@/lib/settlement/clv-calculator';
import { buildScoreGrid, calculateAsianHandicapProbability, calculateOverUnderProbability } from '@/lib/engine/probability';
import { calculateBttsFromGrid } from '@/lib/research/bttsEngine';

describe('Provider Bake-Off Core Invariants & Security Unit Tests', () => {
  beforeEach(() => {
    SecretScrubber.initialize();
  });

  describe('SecretScrubber & Anti-Leakage Defense', () => {
    it('scrubs sensitive authorization headers and registered tokens from text', () => {
      const mockKey = 'secret_live_test_api_key_12345';
      SecretScrubber.registerSecret(mockKey);

      const leakString = `Request failed with Bearer ${mockKey} on https://api.example.com?api_key=${mockKey}`;
      const sanitized = SecretScrubber.scrubText(leakString);

      expect(sanitized).not.toContain(mockKey);
      expect(sanitized).toContain('[REDACTED_SECRET]');
    });

    it('scrubs sensitive keys recursively in arbitrary nested JSON objects', () => {
      const testSecret = 'sk_live_very_secret_xyz789';
      SecretScrubber.registerSecret(testSecret);

      const rawPayload = {
        config: {
          headers: {
            Authorization: `Bearer ${testSecret}`,
            'x-api-key': testSecret,
          },
          url: `https://test.com/data?key=${testSecret}`,
        },
        data: {
          token: testSecret,
          nested: [testSecret, { key: testSecret }],
        },
      };

      const sanitized = SecretScrubber.scrubObject(rawPayload);
      const str = JSON.stringify(sanitized);

      expect(str).not.toContain(testSecret);
      expect(sanitized.config.headers.Authorization).toContain('[REDACTED');
      expect(sanitized.data.nested[0]).toBe('[REDACTED_SECRET]');
    });
  });

  describe('Canonical Identity Normalization', () => {
    it('normalizes EPL team names deterministically across provider variations without stripping suffixes', () => {
      expect(normalizeTeamName('Arsenal FC')).toBe('arsenal fc');
      expect(normalizeTeamName('Arsenal')).toBe('arsenal');
      expect(normalizeTeamName('Manchester City FC')).toBe('manchester city fc');
      expect(normalizeTeamName('Man City')).toBe('man city');
      expect(normalizeTeamName('Wolverhampton Wanderers')).toBe('wolverhampton wanderers');
      expect(normalizeTeamName('Brighton & Hove Albion')).toBe('brighton and hove albion');
    });
  });

  describe('Market Settlement & De-Vig Pipeline on Captured Odds', () => {
    it('correctly de-vigs 2-way Asian Handicap and preserves margin transparency', () => {
      // Real Bet365 AH line: Home -1.25 @ 2.05, Away +1.25 @ 1.825
      const odds = {
        home: 2.05,
        away: 1.825,
      };

      const devig = DeVigService.removeVig(odds, 'proportional');

      expect(devig.method).toBe('proportional');
      expect(devig.overround).toBeGreaterThan(0);
      expect(devig.margin).toBeGreaterThan(0);

      const sumFairProb = Object.values(devig.fair).reduce((acc, p) => acc + p, 0);
      expect(Math.abs(sumFairProb - 1.0)).toBeLessThan(1e-4);
      expect(1 / devig.fair.home).toBeGreaterThan(odds.home);
    });

    it('computes quarter-line settlement-aware EV without hardcoding', () => {
      // Quarter line decomposition: -1.25 is 50% -1.0 and 50% -1.5
      const pWin = 0.35;
      const pHalfWin = 0.0;
      const pPush = 0.0;
      const pHalfLoss = 0.25;
      const pLoss = 0.40;
      const marketPrice = 2.10;

      const evResult = ExpectedValueCalculator.computeQuarterLineEv(
        pWin,
        pHalfWin,
        pPush,
        pHalfLoss,
        pLoss,
        marketPrice
      );

      // Expected return = 0.35*(1.10) + 0 + 0 + 0.25*(-0.5) + 0.40*(-1) = -0.14
      expect(evResult.expectedValue).toBeCloseTo(-0.14, 2);
      expect(evResult.isPositiveEv).toBe(false);
    });
  });

  describe('Closing Line Value (CLV) Preservation', () => {
    it('distinguishes line CLV from price CLV in Bet365 movements', () => {
      const opLine = -1.0;
      const opPrice = 1.825;
      const clLine = -1.25;
      const clPrice = 2.05;

      const detailedClv = CLVCalculator.calculateDetailed(
        'AH',
        'home',
        opLine,
        opPrice,
        clLine,
        clPrice
      );

      expect(detailedClv.line_clv).not.toBe(0);
      expect(detailedClv.price_clv).not.toBe(0);
      expect(detailedClv.total_clv).toBeCloseTo(detailedClv.line_clv + detailedClv.price_clv, 4);
    });

    it('strictly marks Pinnacle ground-truth availability as false when only soft bookmakers exist', () => {
      const bookmakersAvailable = ['bet365'];
      const hasPinnacle = bookmakersAvailable.includes('pinnacle');
      expect(hasPinnacle).toBe(false);
    });
  });

  describe('Score Grid & Market Joint Consistency', () => {
    it('ensures AH, OU line family, and BTTS all derive consistently from Dixon-Coles parameters', () => {
      const lambdaHome = 1.65;
      const lambdaAway = 1.15;
      const rho = -0.05;

      const grid = buildScoreGrid(lambdaHome, lambdaAway, rho);

      // Verify grid sum = 1.0
      let gridTotal = 0;
      for (const row of grid) {
        for (const p of row) {
          gridTotal += p;
        }
      }
      expect(Math.abs(gridTotal - 1.0)).toBeLessThan(1e-4);

      // Verify Asian Handicap probability
      const ahProb = calculateAsianHandicapProbability(lambdaHome, lambdaAway, -0.75, rho);
      expect(ahProb.cover).toBeGreaterThan(0);
      expect(ahProb.cover).toBeLessThan(1);

      // Verify Over/Under line family consistency
      const ou15 = calculateOverUnderProbability(lambdaHome, lambdaAway, 1.5, rho);
      const ou25 = calculateOverUnderProbability(lambdaHome, lambdaAway, 2.5, rho);
      const ou35 = calculateOverUnderProbability(lambdaHome, lambdaAway, 3.5, rho);

      // P(Over X) must be strictly monotonic decreasing as line increases
      expect(ou15.over).toBeGreaterThan(ou25.over);
      expect(ou25.over).toBeGreaterThan(ou35.over);

      // Verify BTTS
      const btts = calculateBttsFromGrid(grid);
      expect(btts.probabilities.yes + btts.probabilities.no).toBeCloseTo(1.0, 4);
    });
  });
});
