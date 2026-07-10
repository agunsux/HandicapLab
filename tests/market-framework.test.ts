/**
 * EPIC 7 — Universal Market Framework Unit Tests
 * ================================================
 * Tests for Market Registry, Translators (ML, AH, OU, BTTS),
 * and Settlement Engine.
 *
 * All translators read from a synthetic goal distribution.
 * No ProbabilityEngine integration required for unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketRegistry, marketRegistry, MarketTranslator } from '../src/lib/market/registry';
import { MarketSettlementEngine } from '../src/lib/market/settlement';
import {
  MoneylineTranslator,
  AsianHandicapTranslator,
  OverUnderTranslator,
  BttsTranslator,
  registerDefaultMarkets,
} from '../src/lib/market/translators';
import type { GoalDistribution } from '../src/lib/market/types';

// ─── Synthetic test goal distribution ───────────────────────────────────
// Home team slightly stronger: 70% home win, 20% draw, 10% away win

function makeSyntheticGoalDistribution(homeLambda: number, awayLambda: number): GoalDistribution {
  const scoreMatrix: number[][] = Array.from({ length: 11 }, () => new Array(11).fill(0));
  let total = 0;
  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      const p = (Math.pow(homeLambda, h) * Math.exp(-homeLambda)) / factorial(h) *
                (Math.pow(awayLambda, a) * Math.exp(-awayLambda)) / factorial(a);
      scoreMatrix[h][a] = p;
      total += p;
    }
  }
  if (total > 0) {
    for (let h = 0; h <= 10; h++) {
      for (let a = 0; a <= 10; a++) {
        scoreMatrix[h][a] /= total;
      }
    }
  }
  return { homeLambda, awayLambda, scoreMatrix, expectedGoals: homeLambda + awayLambda };
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

const HOME_FAVORED = makeSyntheticGoalDistribution(1.8, 1.2);
const EVEN_MATCH = makeSyntheticGoalDistribution(1.4, 1.4);
const AWAY_FAVORED = makeSyntheticGoalDistribution(0.8, 2.0);

// ─── Market Registry ────────────────────────────────────────────────────

describe('MarketRegistry', () => {
  it('registers all built-in markets', () => {
    registerDefaultMarkets();
    const markets = marketRegistry.getAllMarkets();
    const types = markets.map((m) => m.id);
    expect(types).toContain('market:ml');
    expect(types).toContain('market:ah');
    expect(types).toContain('market:ou');
    expect(types).toContain('market:btts');
  });

  it('prevents duplicate registration', () => {
    expect(() => marketRegistry.register(new MoneylineTranslator())).toThrow();
  });

  it('throws for unknown market', () => {
    expect(() => marketRegistry.getTranslator('UNKNOWN')).toThrow();
  });
});

// ─── Moneyline Translator ───────────────────────────────────────────────

describe('MoneylineTranslator', () => {
  const t = new MoneylineTranslator();

  it('home team favored when homeLambda > awayLambda', () => {
    const result = t.translate({ goalDistribution: HOME_FAVORED });
    expect(result.homeProbability).toBeGreaterThan(result.awayProbability);
    expect(result.drawProbability).toBeGreaterThan(0.15);
    expect(Math.abs(result.homeProbability + result.drawProbability! + result.awayProbability - 1)).toBeLessThan(0.01);
  });

  it('away team favored when awayLambda > homeLambda', () => {
    const result = t.translate({ goalDistribution: AWAY_FAVORED });
    expect(result.awayProbability).toBeGreaterThan(result.homeProbability);
  });

  it('even match has draw as most likely single outcome', () => {
    // For equal lambda, draw should be significant
    const result = t.translate({ goalDistribution: EVEN_MATCH });
    expect(result.drawProbability).toBeGreaterThan(0.25);
  });

  it('settles correctly', () => {
    expect(t.settle({ marketType: 'ML', selection: 'home', homeGoals: 2, awayGoals: 0 })).toBe('won');
    expect(t.settle({ marketType: 'ML', selection: 'away', homeGoals: 1, awayGoals: 2 })).toBe('won');
    expect(t.settle({ marketType: 'ML', selection: 'home', homeGoals: 1, awayGoals: 1 })).toBe('void');
    expect(t.settle({ marketType: 'ML', selection: 'home', homeGoals: 0, awayGoals: 2 })).toBe('lost');
  });
});

// ─── Asian Handicap Translator ──────────────────────────────────────────

describe('AsianHandicapTranslator', () => {
  const t = new AsianHandicapTranslator();

  it('home -0.5 requires home win', () => {
    const result = t.translate({ goalDistribution: HOME_FAVORED, line: -0.5 });
    expect(result.homeProbability).toBeGreaterThan(0.5);
    expect(result.drawProbability).toBeNull();
  });

  it('settles correctly', () => {
    expect(t.settle({ marketType: 'AH', selection: 'home', homeGoals: 2, awayGoals: 1, line: -0.5 })).toBe('won');
    expect(t.settle({ marketType: 'AH', selection: 'home', homeGoals: 1, awayGoals: 1, line: -0.5 })).toBe('lost');
  });
});

// ─── Over/Under Translator ──────────────────────────────────────────────

describe('OverUnderTranslator', () => {
  const t = new OverUnderTranslator();

  it('over 2.5 in high-scoring match', () => {
    const highScoring = makeSyntheticGoalDistribution(2.5, 2.0);
    const result = t.translate({ goalDistribution: highScoring, line: 2.5 });
    expect(result.homeProbability).toBeGreaterThan(0.5); // over 2.5 likely
  });

  it('under 2.5 in low-scoring match', () => {
    const lowScoring = makeSyntheticGoalDistribution(0.5, 0.5);
    const result = t.translate({ goalDistribution: lowScoring, line: 2.5 });
    expect(result.awayProbability).toBeGreaterThan(0.8); // under 2.5 very likely
  });

  it('settles correctly', () => {
    expect(t.settle({ marketType: 'OU', selection: 'over', homeGoals: 3, awayGoals: 2, line: 2.5 })).toBe('won');
    expect(t.settle({ marketType: 'OU', selection: 'over', homeGoals: 1, awayGoals: 0, line: 2.5 })).toBe('lost');
    expect(t.settle({ marketType: 'OU', selection: 'over', homeGoals: 2, awayGoals: 0, line: 2.5 })).toBe('lost');
  });
});

// ─── BTTS Translator ────────────────────────────────────────────────────

describe('BttsTranslator', () => {
  const t = new BttsTranslator();

  it('BTTS Yes higher when both teams score', () => {
    // Even match with ~1.4 each means both likely to score
    const result = t.translate({ goalDistribution: EVEN_MATCH });
    expect(result.homeProbability).toBeGreaterThan(0.4); // BTTS Yes
    expect(result.awayProbability).toBeLessThan(0.6);   // BTTS No
  });

  it('settles correctly', () => {
    expect(t.settle({ marketType: 'BTTS', selection: 'yes', homeGoals: 2, awayGoals: 1 })).toBe('won');
    expect(t.settle({ marketType: 'BTTS', selection: 'yes', homeGoals: 2, awayGoals: 0 })).toBe('lost');
    expect(t.settle({ marketType: 'BTTS', selection: 'yes', homeGoals: 0, awayGoals: 0 })).toBe('lost');
    expect(t.settle({ marketType: 'BTTS', selection: 'yes', homeGoals: 1, awayGoals: 3 })).toBe('won');
  });
});

// ─── Settlement Engine ──────────────────────────────────────────────────

describe('MarketSettlementEngine', () => {
  const engine = new MarketSettlementEngine();

  it('settles any registered market', () => {
    expect(engine.settle('ML', 2, 0, 'home')).toBe('won');
    expect(engine.settle('AH', 2, 0, 'home', -0.5)).toBe('won');
    expect(engine.settle('OU', 3, 1, 'over', 2.5)).toBe('won');
    expect(engine.settle('BTTS', 2, 1, 'yes')).toBe('won');
  });

  it('batches settlements', () => {
    const results = MarketSettlementEngine.settleAll([
      { marketType: 'ML', homeGoals: 2, awayGoals: 0, selection: 'home' },
      { marketType: 'ML', homeGoals: 0, awayGoals: 1, selection: 'home' },
      { marketType: 'BTTS', homeGoals: 1, awayGoals: 1, selection: 'yes' },
    ]);
    expect(results).toEqual(['won', 'lost', 'won']);
  });
});

// ─── Probability Sum (all markets) ────────────────────────────────────

describe('Market Translation Integrity', () => {
  it('all market probabilities sum to 1 (where applicable)', () => {
    const dist = HOME_FAVORED;

    const mlResult = marketRegistry.translate('ML', { goalDistribution: dist });
    expect(Math.abs(mlResult.homeProbability + mlResult.drawProbability! + mlResult.awayProbability - 1)).toBeLessThan(0.01);

    const ahResult = marketRegistry.translate('AH', { goalDistribution: dist, line: -0.5 });
    expect(Math.abs(ahResult.homeProbability + ahResult.awayProbability - 1)).toBeLessThan(0.01);

    const ouResult = marketRegistry.translate('OU', { goalDistribution: dist, line: 2.5 });
    expect(Math.abs(ouResult.homeProbability + ouResult.awayProbability - 1)).toBeLessThan(0.01);

    const bttsResult = marketRegistry.translate('BTTS', { goalDistribution: dist });
    expect(Math.abs(bttsResult.homeProbability + bttsResult.awayProbability - 1)).toBeLessThan(0.01);
  });
});
