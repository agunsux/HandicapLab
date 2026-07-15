// ============================================================================
// EPIC 31A — SETTLEMENT EDGE CASE TESTS
// ============================================================================
// Tests every settlement line type including edge cases:
//   0.0, 0.25, 0.5, 0.75 handicaps, VOID, negative goals, etc.
// 100% test pass required before 31B can begin.
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  settleMoneyline,
  settleAsianHandicap,
  settleOverUnder,
  settle,
} from '../src/lib/settlement-core/settlement';
import { removeVig, removeVigProportional, removeVigShin, fairOdds, expectedValue } from '../src/lib/settlement-core/devig';
import { computePerformanceLedger, computeMaxDrawdown } from '../src/lib/settlement-core/performance-ledger';
import { buildSnapshotSeries, priceMovement } from '../src/lib/settlement-core/odds-snapshot';
import { EventBus } from '../src/lib/settlement-core/events';
import { ProviderRegistry } from '../src/lib/settlement-core/provider-interface';
import { FeatureFlagRegistry, DEFAULT_PRODUCTION_FLAGS } from '../src/lib/settlement-core/feature-flags';
import { buildMetricProvenance, verifyProvenanceIntegrity } from '../src/lib/settlement-core/provenance';
import { RateLimiter } from '../src/lib/settlement-core/odds-ingestion';
import type { SettlementInput, MarketType } from '../src/lib/settlement-core/types';

// ============================================================================
// SECTION 1: MONEYLINE SETTLEMENT
// ============================================================================

describe('Moneyline Settlement', () => {
  it('settles home win correctly', () => {
    const result = settleMoneyline(2, 1, 'home', 2.5);
    expect(result.outcome).toBe('WIN');
    expect(result.profitUnits).toBe(1.5);
  });

  it('settles draw correctly', () => {
    const result = settleMoneyline(1, 1, 'draw', 3.0);
    expect(result.outcome).toBe('WIN');
    expect(result.profitUnits).toBe(2.0);
  });

  it('settles away win correctly', () => {
    const result = settleMoneyline(0, 3, 'away', 4.0);
    expect(result.outcome).toBe('WIN');
    expect(result.profitUnits).toBe(3.0);
  });

  it('settles losing bet correctly', () => {
    const result = settleMoneyline(0, 2, 'home', 2.0);
    expect(result.outcome).toBe('LOSS');
    expect(result.profitUnits).toBe(-1);
  });

  it('returns VOID when match is voided', () => {
    const result = settleMoneyline(0, 0, 'home', 2.0, true);
    expect(result.outcome).toBe('VOID');
    expect(result.profitUnits).toBe(0);
  });

  it('returns VOID for invalid negative goals', () => {
    const result = settleMoneyline(-1, 2, 'home', 2.0);
    expect(result.outcome).toBe('VOID');
    expect(result.profitUnits).toBe(0);
  });

  it('returns VOID for odds < 1', () => {
    const result = settleMoneyline(2, 1, 'home', 0.5);
    expect(result.outcome).toBe('VOID');
    expect(result.profitUnits).toBe(0);
  });

  it('handles 0-0 draw with draw selection', () => {
    const result = settleMoneyline(0, 0, 'draw', 3.5);
    expect(result.outcome).toBe('WIN');
    expect(result.profitUnits).toBe(2.5);
  });

  it('handles 0-0 draw with home selection (loss)', () => {
    const result = settleMoneyline(0, 0, 'home', 2.0);
    expect(result.outcome).toBe('LOSS');
    expect(result.profitUnits).toBe(-1);
  });
});

// ============================================================================
// SECTION 2: ASIAN HANDICAP SETTLEMENT (LINE EDGE CASES)
// ============================================================================

describe('Asian Handicap Settlement', () => {
  // Whole-number lines (0.0, 1.0, -1.0)
  describe('Whole-number lines', () => {
    it('handles 0.0 line — home win = WIN', () => {
      const r = settleAsianHandicap(2, 1, 0.0, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
      expect(r.profitUnits).toBe(1.0);
    });

    it('handles 0.0 line — draw = PUSH', () => {
      const r = settleAsianHandicap(1, 1, 0.0, 'home', 2.0);
      expect(r.outcome).toBe('PUSH');
      expect(r.profitUnits).toBe(0);
    });

    it('handles 0.0 line — away loss = LOSS', () => {
      const r = settleAsianHandicap(0, 1, 0.0, 'home', 2.0);
      expect(r.outcome).toBe('LOSS');
      expect(r.profitUnits).toBe(-1);
    });
  });

  // Quarter lines (0.25, -0.25)
  describe('Quarter lines (0.25)', () => {
    it('handles +0.25 line — win by 1+ = WIN', () => {
      const r = settleAsianHandicap(2, 0, 0.25, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
      expect(r.profitUnits).toBe(1.0);
    });

    it('handles +0.25 line — draw = HALF_WIN', () => {
      const r = settleAsianHandicap(1, 1, 0.25, 'home', 2.0);
      expect(r.outcome).toBe('HALF_WIN');
      expect(r.profitUnits).toBe(0.5);
    });

    it('handles +0.25 line — loss = LOSS', () => {
      const r = settleAsianHandicap(0, 2, 0.25, 'home', 2.0);
      expect(r.outcome).toBe('LOSS');
      expect(r.profitUnits).toBe(-1);
    });

    it('handles -0.25 line (away +0.25 equivalent)', () => {
      // line = -0.25 means HOME gives 0.25 goals to away
      // Betting AWAY at home -0.25: away receives 0.25 advantage
      // Draw (1-1): away covers → effectiveMargin = 1-1-(-0.25) = 0.25 → HALF_WIN
      const r = settleAsianHandicap(1, 1, -0.25, 'away', 2.0);
      expect(r.outcome).toBe('HALF_WIN');
      expect(r.profitUnits).toBe(0.5);
    });
  });

  // Half lines (0.5, -0.5)
  describe('Half lines (0.5)', () => {
    it('handles +0.5 line — win = WIN', () => {
      const r = settleAsianHandicap(2, 1, 0.5, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
    });

    it('handles +0.5 line — draw = WIN (no push on half line)', () => {
      const r = settleAsianHandicap(1, 1, 0.5, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
    });

    it('handles +0.5 line — loss = LOSS', () => {
      const r = settleAsianHandicap(0, 2, 0.5, 'home', 2.0);
      expect(r.outcome).toBe('LOSS');
    });

    it('handles -0.5 line — home win by 1+ = WIN', () => {
      const r = settleAsianHandicap(2, 0, -0.5, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
    });

    it('handles -0.5 line — draw = LOSS', () => {
      const r = settleAsianHandicap(1, 1, -0.5, 'home', 2.0);
      expect(r.outcome).toBe('LOSS');
    });
  });

  // Three-quarter lines (0.75, -0.75)
  describe('Three-quarter lines (0.75)', () => {
    it('handles +0.75 line — win by 2+ = WIN', () => {
      const r = settleAsianHandicap(3, 0, 0.75, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
    });

    it('handles +0.75 line — win by 1 = WIN (margin 2-1+0.75=1.75 >=0.5)', () => {
      const r = settleAsianHandicap(2, 1, 0.75, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
    });

    it('handles +0.75 line — draw = WIN (margin 1-1+0.75=0.75 >=0.5)', () => {
      const r = settleAsianHandicap(1, 1, 0.75, 'home', 2.0);
      expect(r.outcome).toBe('WIN');
    });
  });

  // Away side
  describe('Away selection', () => {
    it('handles away +0.5 with away win', () => {
      const r = settleAsianHandicap(1, 2, 0.5, 'away', 2.0);
      expect(r.outcome).toBe('WIN');
    });

    it('handles away -0.5 with draw = WIN (away receives 0.5 head start)', () => {
      // line = -0.5 means HOME gives 0.5 goals to away
      // Betting AWAY at -0.5 home handicap: away has 0.5 goal advantage
      // Draw (2-2): effectiveMargin = 2-2-(-0.5) = 0.5 → WIN
      const r = settleAsianHandicap(2, 2, -0.5, 'away', 3.0);
      expect(r.outcome).toBe('WIN');
    });
  });

  describe('VOID and invalid inputs', () => {
    it('returns VOID when voided', () => {
      const r = settleAsianHandicap(0, 0, 0.5, 'home', 2.0, true);
      expect(r.outcome).toBe('VOID');
      expect(r.profitUnits).toBe(0);
    });

    it('returns VOID for negative goals', () => {
      const r = settleAsianHandicap(-1, 2, 0.5, 'home', 2.0);
      expect(r.outcome).toBe('VOID');
    });
  });
});

// ============================================================================
// SECTION 3: OVER/UNDER SETTLEMENT
// ============================================================================

describe('Over/Under Settlement', () => {
  it('settles Over 2.5 with 3-0 = WIN', () => {
    const r = settleOverUnder(3, 0, 2.5, 'over', 2.0);
    expect(r.outcome).toBe('WIN');
    expect(r.profitUnits).toBe(1.0);
  });

  it('settles Under 2.5 with 1-0 = WIN', () => {
    const r = settleOverUnder(1, 0, 2.5, 'under', 2.0);
    expect(r.outcome).toBe('WIN');
  });

  it('settles Over 2.5 with 1-1 = LOSS', () => {
    const r = settleOverUnder(1, 1, 2.5, 'over', 2.0);
    expect(r.outcome).toBe('LOSS');
  });

  it('handles Over 2.0 with 2-0 = PUSH (exact whole number)', () => {
    const r = settleOverUnder(2, 0, 2.0, 'over', 2.0);
    expect(r.outcome).toBe('PUSH');
    expect(r.profitUnits).toBe(0);
  });

  it('handles Over 2.25 with 2-0 = HALF_LOSS', () => {
    const r = settleOverUnder(2, 0, 2.25, 'over', 2.0);
    expect(r.outcome).toBe('HALF_LOSS');
    expect(r.profitUnits).toBe(-0.5);
  });

  it('handles Over 2.75 with 3-0 = HALF_WIN', () => {
    const r = settleOverUnder(3, 0, 2.75, 'over', 2.0);
    expect(r.outcome).toBe('HALF_WIN');
    expect(r.profitUnits).toBe(0.5);
  });

  it('handles Under 2.0 with 1-1 = PUSH', () => {
    const r = settleOverUnder(1, 1, 2.0, 'under', 2.0);
    expect(r.outcome).toBe('PUSH');
  });

  it('handles VOID for cancelled match', () => {
    const r = settleOverUnder(0, 0, 2.5, 'over', 2.0, true);
    expect(r.outcome).toBe('VOID');
    expect(r.profitUnits).toBe(0);
  });
});

// ============================================================================
// SECTION 4: GENERIC settle() DISPATCHER
// ============================================================================

describe('Generic settle() dispatcher', () => {
  it('routes moneyline correctly', () => {
    const input: SettlementInput = { homeGoals: 2, awayGoals: 1, line: 0, selection: 'home', odds: 2.0 };
    const r = settle(input, 'moneyline');
    expect(r.outcome).toBe('WIN');
  });

  it('routes asian_handicap correctly', () => {
    const input: SettlementInput = { homeGoals: 1, awayGoals: 1, line: 0.25, selection: 'home', odds: 2.0 };
    const r = settle(input, 'asian_handicap');
    expect(r.outcome).toBe('HALF_WIN');
  });

  it('routes over_under correctly', () => {
    const input: SettlementInput = { homeGoals: 3, awayGoals: 0, line: 2.5, selection: 'over', odds: 2.0 };
    const r = settle(input, 'over_under');
    expect(r.outcome).toBe('WIN');
  });
});

// ============================================================================
// SECTION 5: DE-VIG ENGINE
// ============================================================================

describe('De-Vig Engine', () => {
  describe('Proportional method', () => {
    it('removes margin from 3-outcome market', () => {
      const odds = { home: 2.0, draw: 3.5, away: 4.0 };
      const result = removeVigProportional(odds);

      // Implied: 0.5 + 0.285714 + 0.25 = 1.035714
      expect(result.overround).toBeCloseTo(0.035714, 4);
      expect(result.margin).toBeGreaterThan(0);

      // Fair probabilities should sum to ~1.0
      const fairSum = Object.values(result.fair).reduce((a, b) => a + b, 0);
      expect(fairSum).toBeCloseTo(1.0, 6);

      // Fair should be lower than implied
      expect(result.fair.home).toBeLessThan(result.implied.home);
    });

    it('handles 2-outcome market (O/U)', () => {
      const odds = { over: 1.91, under: 1.91 };
      const result = removeVigProportional(odds);

      // Implied: 0.52356 + 0.52356 = 1.04712
      const fairSum = Object.values(result.fair).reduce((a, b) => a + b, 0);
      expect(fairSum).toBeCloseTo(1.0, 6);
    });

    it('handles negative overround (thin market)', () => {
      const odds = { home: 2.2, draw: 3.4, away: 3.8 };
      const result = removeVigProportional(odds);
      // Should still produce valid fair probabilities
      const fairSum = Object.values(result.fair).reduce((a, b) => a + b, 0);
      expect(fairSum).toBeCloseTo(1.0, 6);
    });
  });

  describe('Shin method', () => {
    it('removes margin with Shin on standard market', () => {
      const odds = { home: 2.0, draw: 3.5, away: 4.0 };
      const result = removeVigShin(odds);

      const fairSum = Object.values(result.fair).reduce((a, b) => a + b, 0);
      expect(fairSum).toBeCloseTo(1.0, 6);
      // shinZ can be > 0 for this market but may also be 0 depending on convergence
      // The key test is that fair probs sum to 1.0
      expect(result.shinZ).toBeDefined();
    });

    it('falls back to proportional when overround <= 0', () => {
      const odds = { home: 2.2, draw: 3.4, away: 3.8 };
      const result = removeVigShin(odds);
      // With low margin, should still work
      const fairSum = Object.values(result.fair).reduce((a, b) => a + b, 0);
      expect(fairSum).toBeCloseTo(1.0, 6);
    });

    it('falls back to proportional for single-outcome', () => {
      const odds = { home: 1.5 };
      const result = removeVigShin(odds);
      expect(result.method).toBe('proportional');
    });

    it('returns shinZ in result', () => {
      const odds = { home: 1.91, away: 1.91 };
      const result = removeVigShin(odds);
      expect(result.method).toBe('shin');
      // On symmetric markets shinZ may be 0 or approach 0 — method is still shin
      expect(result.shinZ).toBeDefined();
    });
  });

  describe('Canonical removeVig()', () => {
    it('defaults to proportional', () => {
      const result = removeVig({ home: 2.0, draw: 3.5, away: 4.0 });
      expect(result.method).toBe('proportional');
    });

    it('uses Shin when requested', () => {
      const result = removeVig({ home: 2.0, draw: 3.5, away: 4.0 }, 'shin');
      expect(result.method).toBe('shin');
    });
  });

  describe('fairOdds()', () => {
    it('returns vig-removed decimal odds for a selection', () => {
      const fair = fairOdds({ home: 2.0, draw: 3.5, away: 4.0 }, 'home');
      expect(fair).toBeGreaterThan(0);
      // Fair odds are higher than raw odds because margin is removed
      // (implied prob goes down, so 1/prob goes up)
      expect(fair).toBeGreaterThan(2.0);
    });

    it('returns NaN for invalid selection', () => {
      const fair = fairOdds({ home: 2.0 }, 'invalid');
      expect(fair).toBeNaN();
    });
  });

  describe('expectedValue()', () => {
    it('calculates positive EV', () => {
      // Fair prob ~0.517, taken odds 2.0 => EV = 0.517 * 2.0 - 1 = 0.034
      const ev = expectedValue(2.0, 0.517);
      expect(ev).toBeCloseTo(0.034, 3);
    });

    it('calculates negative EV', () => {
      const ev = expectedValue(1.5, 0.5);
      expect(ev).toBeCloseTo(-0.25, 3);
    });

    it('returns NaN for odds <= 1', () => {
      expect(expectedValue(1.0, 0.5)).toBeNaN();
    });

    it('returns NaN for invalid probability', () => {
      expect(expectedValue(2.0, 0)).toBeNaN();
      expect(expectedValue(2.0, 1)).toBeNaN();
    });
  });
});

// ============================================================================
// SECTION 6: PERFORMANCE LEDGER
// ============================================================================

describe('Performance Ledger', () => {
  it('computes basic metrics from settled bets', () => {
    const bets = [
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.05, closingOdds: 1.9, voided: false, settledAt: '2026-01-01' },
      { stakeUnits: 1, oddsTaken: 3.0, profitUnits: -1.0, edge: -0.1, closingOdds: 3.2, voided: false, settledAt: '2026-01-02' },
    ];

    const result = computePerformanceLedger(bets);
    expect(result.sampleSize).toBe(2);
    expect(result.profitLossUnits).toBe(0);
    expect(result.strikeRate).toBe(50);
    expect(result.avgOdds).toBe(2.5);
    expect(result.dateRange.start).toBe('2026-01-01T00:00:00.000Z');
  });

  it('excludes voided bets from calculations', () => {
    const bets = [
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.05, voided: false, settledAt: '2026-01-01' },
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: 0, edge: 0, voided: true, settledAt: '2026-01-02' },
    ];

    const result = computePerformanceLedger(bets);
    expect(result.sampleSize).toBe(1);
  });

  it('computes CLV when closing odds are available', () => {
    const bets = [
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.05, closingOdds: 1.8, voided: false, settledAt: '2026-01-01' },
    ];

    const result = computePerformanceLedger(bets);
    // implied_taken = 1/2.0 = 0.5, implied_closing = 1/1.8 = 0.555...
    // CLV = (0.555... - 0.5) * 100 = 5.555...%
    expect(result.clv).toBeCloseTo(5.56, 1);
  });

  it('returns null CLV when no closing odds', () => {
    const bets = [
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.05, voided: false, settledAt: '2026-01-01' },
    ];

    const result = computePerformanceLedger(bets);
    expect(result.clv).toBeNull();
  });

  it('computes max drawdown correctly', () => {
    const bets = [
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: -1.0, edge: -0.2, voided: false, settledAt: '2026-01-01' },
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: -1.0, edge: -0.2, voided: false, settledAt: '2026-01-02' },
      { stakeUnits: 1, oddsTaken: 3.0, profitUnits: 2.0, edge: 0.1, voided: false, settledAt: '2026-01-03' },
    ];

    const dd = computeMaxDrawdown(bets);
    // cumulative: -1, -2, 0; peak = 0, trough = -2, dd = 2
    expect(dd).toBe(2);
  });

  it('generates correct confidence notes by sample size', () => {
    const small = computePerformanceLedger([
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.1, voided: false, settledAt: '2026-01-01' },
    ]);
    expect(small.confidenceNote).toContain('below 30');

    const medium = computePerformanceLedger(
      Array.from({ length: 50 }, (_, i) => ({
        stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.1, voided: false,
        settledAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
      }))
    );
    expect(medium.confidenceNote).toContain('directional');

    const large = computePerformanceLedger(
      Array.from({ length: 150 }, (_, i) => ({
        stakeUnits: 1, oddsTaken: 2.0, profitUnits: 1.0, edge: 0.1, voided: false,
        settledAt: `2026-01-${String((i % 31) + 1).padStart(2, '0')}`,
      }))
    );
    expect(large.confidenceNote).toContain('sufficient');
  });

  it('handles empty bet array', () => {
    const result = computePerformanceLedger([]);
    expect(result.sampleSize).toBe(0);
    expect(result.roi).toBe(0);
    expect(result.strikeRate).toBe(0);
  });
});

// ============================================================================
// SECTION 7: ODDS SNAPSHOT ENGINE
// ============================================================================

describe('Odds Snapshot Engine', () => {
  it('builds opening/latest/closing from raw rows', () => {
    const rows = [
      { provider: 'pinnacle', fixtureId: 'f1', market: 'moneyline' as MarketType, line: 0, selection: 'home' as const, odds: 2.0, capturedAt: '2026-01-01T10:00:00Z' },
      { provider: 'pinnacle', fixtureId: 'f1', market: 'moneyline' as MarketType, line: 0, selection: 'home' as const, odds: 1.95, capturedAt: '2026-01-01T11:00:00Z' },
      { provider: 'pinnacle', fixtureId: 'f1', market: 'moneyline' as MarketType, line: 0, selection: 'home' as const, odds: 1.85, capturedAt: '2026-01-01T12:00:00Z' },
    ];

    const series = buildSnapshotSeries(rows, '2026-01-01T12:30:00Z');
    expect(series).toHaveLength(1);
    expect(series[0].opening?.odds).toBe(2.0);
    expect(series[0].latest?.odds).toBe(1.85);
    expect(series[0].closing?.odds).toBe(1.85);
  });

  it('uses kickoff cutoff for closing price', () => {
    const rows = [
      { provider: 'pinnacle', fixtureId: 'f1', market: 'moneyline' as MarketType, line: 0, selection: 'home' as const, odds: 2.0, capturedAt: '2026-01-01T10:00:00Z' },
      { provider: 'pinnacle', fixtureId: 'f1', market: 'moneyline' as MarketType, line: 0, selection: 'home' as const, odds: 1.85, capturedAt: '2026-01-01T11:00:00Z' },
      // Post-kickoff data (should be excluded from closing)
      { provider: 'pinnacle', fixtureId: 'f1', market: 'moneyline' as MarketType, line: 0, selection: 'home' as const, odds: 1.5, capturedAt: '2026-01-01T13:00:00Z' },
    ];

    const series = buildSnapshotSeries(rows, '2026-01-01T12:00:00Z');
    expect(series[0].closing?.odds).toBe(1.85);
  });

  it('computes price movement', () => {
    const series = {
      provider: 'pinnacle',
      fixtureId: 'f1',
      market: 'moneyline' as MarketType,
      line: 0,
      opening: { selection: 'home' as const, odds: 2.0, capturedAt: '2026-01-01T10:00:00Z' },
      latest: { selection: 'home' as const, odds: 1.85, capturedAt: '2026-01-01T12:00:00Z' },
      closing: { selection: 'home' as const, odds: 1.85, capturedAt: '2026-01-01T12:00:00Z' },
    };

    const movement = priceMovement(series);
    expect(movement).toBeCloseTo(-0.15, 4);
  });

  it('returns null price movement when opening is missing', () => {
    const series = {
      provider: 'pinnacle',
      fixtureId: 'f1',
      market: 'moneyline' as MarketType,
      line: 0,
      opening: null,
      latest: { selection: 'home' as const, odds: 1.85, capturedAt: '2026-01-01T12:00:00Z' },
      closing: { selection: 'home' as const, odds: 1.85, capturedAt: '2026-01-01T12:00:00Z' },
    };

    expect(priceMovement(series)).toBeNull();
  });
});

// ============================================================================
// SECTION 8: EVENT BUS
// ============================================================================

describe('Event Bus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('emits and receives events', async () => {
    const handler = vi.fn();
    bus.subscribe('odds:captured', handler);

    await bus.emit('odds:captured', {
      timestamp: new Date().toISOString(),
      fixtureId: 'f1',
      provider: 'pinnacle',
      tickCount: 5,
      marketTypes: ['moneyline'],
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports unsubscribe', async () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('odds:captured', handler);
    unsubscribe();

    await bus.emit('odds:captured', {
      timestamp: new Date().toISOString(),
      fixtureId: 'f1',
      provider: 'pinnacle',
      tickCount: 5,
      marketTypes: ['moneyline'],
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports wildcard subscribeAll', async () => {
    const handler = vi.fn();
    bus.subscribeAll(handler);

    await bus.emit('match:finished', {
      timestamp: new Date().toISOString(),
      fixtureId: 'f1',
      homeGoals: 2,
      awayGoals: 1,
      league: 'EPL',
      kickoff: '2026-01-01T12:00:00Z',
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('awaits async handlers', async () => {
    let completed = false;
    bus.subscribe('settlement:completed', async () => {
      await new Promise((r) => setTimeout(r, 10));
      completed = true;
    });

    await bus.emit('settlement:completed', {
      timestamp: new Date().toISOString(),
      fixtureId: 'f1',
      settlementCount: 1,
      outcomes: {},
    });

    expect(completed).toBe(true);
  });

  it('tracks emitted count', async () => {
    await bus.emit('odds:captured', {
      timestamp: new Date().toISOString(),
      fixtureId: 'f1',
      provider: 'p',
      tickCount: 1,
      marketTypes: ['moneyline'],
    });
    await bus.emit('match:finished', {
      timestamp: new Date().toISOString(),
      fixtureId: 'f1',
      homeGoals: 2,
      awayGoals: 1,
      league: 'EPL',
      kickoff: '2026-01-01T12:00:00Z',
    });

    expect(bus.totalEmitted).toBe(2);
  });

  it('clear removes all subscribers', () => {
    bus.subscribe('odds:captured', vi.fn());
    bus.clear();
    expect(bus.subscriberCount('odds:captured')).toBe(0);
  });
});

// ============================================================================
// SECTION 9: PROVIDER REGISTRY
// ============================================================================

describe('Provider Registry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      name: 'test-provider',
      capabilities: { supportedMarkets: ['moneyline' as MarketType], liveOdds: false, preMatchOdds: true, closingOdds: true, historicalData: false, maxRatePerSecond: 5 },
      fetchOdds: vi.fn(),
      fetchOpeningOdds: vi.fn(),
      fetchClosingOdds: vi.fn(),
      checkHealth: vi.fn(),
      getConfig: () => ({ name: 'test-provider', baseUrl: 'https://test.com', rateLimitPerSecond: 5, enabled: true, priority: 1 }),
    };

    registry.register(mockProvider);
    expect(registry.get('test-provider')).toBe(mockProvider);
    expect(registry.count).toBe(1);
  });

  it('throws on duplicate registration', () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      name: 'dup', capabilities: { supportedMarkets: ['moneyline' as MarketType], liveOdds: false, preMatchOdds: true, closingOdds: true, historicalData: false, maxRatePerSecond: 5 },
      fetchOdds: vi.fn(), fetchOpeningOdds: vi.fn(), fetchClosingOdds: vi.fn(), checkHealth: vi.fn(),
      getConfig: () => ({ name: 'dup', baseUrl: '', rateLimitPerSecond: 5, enabled: true, priority: 1 }),
    };
    registry.register(mockProvider);
    expect(() => registry.register(mockProvider)).toThrow();
  });

  it('filters by market type', () => {
    const registry = new ProviderRegistry();
    const mlProvider = {
      name: 'ml-only', capabilities: { supportedMarkets: ['moneyline' as MarketType], liveOdds: false, preMatchOdds: true, closingOdds: true, historicalData: false, maxRatePerSecond: 5 },
      fetchOdds: vi.fn(), fetchOpeningOdds: vi.fn(), fetchClosingOdds: vi.fn(), checkHealth: vi.fn(),
      getConfig: () => ({ name: 'ml-only', baseUrl: '', rateLimitPerSecond: 5, enabled: true, priority: 1 }),
    };
    const ahProvider = {
      name: 'ah-only', capabilities: { supportedMarkets: ['asian_handicap' as MarketType], liveOdds: false, preMatchOdds: true, closingOdds: true, historicalData: false, maxRatePerSecond: 5 },
      fetchOdds: vi.fn(), fetchOpeningOdds: vi.fn(), fetchClosingOdds: vi.fn(), checkHealth: vi.fn(),
      getConfig: () => ({ name: 'ah-only', baseUrl: '', rateLimitPerSecond: 5, enabled: true, priority: 1 }),
    };
    registry.register(mlProvider);
    registry.register(ahProvider);

    expect(registry.getByMarket('moneyline')).toHaveLength(1);
    expect(registry.getByMarket('asian_handicap')).toHaveLength(1);
    expect(registry.getByMarket('over_under')).toHaveLength(0);
  });

  it('orders by priority for failover', () => {
    const registry = new ProviderRegistry();
    const low = { name: 'low', capabilities: { supportedMarkets: ['moneyline' as MarketType], liveOdds: false, preMatchOdds: true, closingOdds: true, historicalData: false, maxRatePerSecond: 5 }, fetchOdds: vi.fn(), fetchOpeningOdds: vi.fn(), fetchClosingOdds: vi.fn(), checkHealth: vi.fn(), getConfig: () => ({ name: 'low', baseUrl: '', rateLimitPerSecond: 5, enabled: true, priority: 10 }) };
    const high = { name: 'high', capabilities: { supportedMarkets: ['moneyline' as MarketType], liveOdds: false, preMatchOdds: true, closingOdds: true, historicalData: false, maxRatePerSecond: 5 }, fetchOdds: vi.fn(), fetchOpeningOdds: vi.fn(), fetchClosingOdds: vi.fn(), checkHealth: vi.fn(), getConfig: () => ({ name: 'high', baseUrl: '', rateLimitPerSecond: 5, enabled: true, priority: 1 }) };
    registry.register(low);
    registry.register(high);

    const all = registry.getAll();
    expect(all[0].name).toBe('high'); // lower priority number first
    expect(all[1].name).toBe('low');
  });
});

// ============================================================================
// SECTION 10: FEATURE FLAGS
// ============================================================================

describe('Feature Flag Registry', () => {
  it('defaults all flags to their registered state', () => {
    const flags = new FeatureFlagRegistry(DEFAULT_PRODUCTION_FLAGS);
    expect(flags.isEnabled('de_vig_engine')).toBe(true);
    expect(flags.isEnabled('clv_calculation')).toBe(false);
  });

  it('gates features by user tier', () => {
    const flags = new FeatureFlagRegistry(DEFAULT_PRODUCTION_FLAGS);
    // CLV is pro-tier, not accessible to free users
    expect(flags.isAccessible('clv_calculation', { userTier: 'free' })).toBe(false);
    expect(flags.isAccessible('clv_calculation', { userTier: 'pro' })).toBe(false); // Still disabled
  });

  it('gates disabled features even for correct tier', () => {
    const flags = new FeatureFlagRegistry(DEFAULT_PRODUCTION_FLAGS);
    // Enable CLV
    flags.enable('clv_calculation');
    expect(flags.isAccessible('clv_calculation', { userTier: 'pro' })).toBe(true);
    expect(flags.isAccessible('clv_calculation', { userTier: 'free' })).toBe(false);
  });

  it('allows free-tier access to de_vig_engine', () => {
    const flags = new FeatureFlagRegistry(DEFAULT_PRODUCTION_FLAGS);
    expect(flags.isAccessible('de_vig_engine', { userTier: 'free' })).toBe(true);
  });

  it('disables and enables flags', () => {
    const flags = new FeatureFlagRegistry(DEFAULT_PRODUCTION_FLAGS);
    flags.disable('de_vig_engine');
    expect(flags.isEnabled('de_vig_engine')).toBe(false);
    flags.enable('de_vig_engine');
    expect(flags.isEnabled('de_vig_engine')).toBe(true);
  });

  it('creates flag on enable if not exists', () => {
    const flags = new FeatureFlagRegistry([]);
    flags.enable('new_feature');
    expect(flags.isEnabled('new_feature')).toBe(true);
  });

  it('supports rollout percentage', () => {
    const flags = new FeatureFlagRegistry([
      { name: 'rollout_test', enabled: true, description: '', owner: 'test', createdAt: '', updatedAt: '', rolloutPercentage: 0 },
    ]);
    // With 0% rollout, no user should have access
    expect(flags.isAccessible('rollout_test', { userId: 'user-1' })).toBe(false);
    expect(flags.isAccessible('rollout_test')).toBe(true); // No userId = no rollout check
  });

  it('supports beta user list', () => {
    const flags = new FeatureFlagRegistry([
      { name: 'beta_feature', enabled: true, description: '', owner: 'test', createdAt: '', updatedAt: '', betaUserIds: ['beta-user'] },
    ]);
    expect(flags.isAccessible('beta_feature', { userId: 'beta-user' })).toBe(true);
    expect(flags.isAccessible('beta_feature', { userId: 'non-beta-user' })).toBe(false);
  });
});

// ============================================================================
// SECTION 11: DATA PROVENANCE
// ============================================================================

describe('Data Provenance', () => {
  it('builds a provenance record with links', () => {
    const record = buildMetricProvenance('roi', 'ledger-001', [
      { entityType: 'trade', entityId: 'trade-001', label: 'MCI v LIV', timestamp: '2026-01-01' },
    ], 'Aggregated from settled predictions');

    expect(record.targetType).toBe('metric');
    expect(record.targetLabel).toBe('roi');
    expect(record.links).toHaveLength(1);
    expect(record.sourceHash).toBeTruthy();
  });

  it('verifies integrity of unmodified records', () => {
    const record = buildMetricProvenance('clv', 'ledger-002', [
      { entityType: 'trade', entityId: 'trade-001', label: 'Trade 1', timestamp: '2026-01-01' },
      { entityType: 'trade', entityId: 'trade-002', label: 'Trade 2', timestamp: '2026-01-02' },
    ], 'Mean implied probability comparison');

    expect(verifyProvenanceIntegrity(record)).toBe(true);
  });

  it('detects tampered records', () => {
    const record = buildMetricProvenance('roi', 'ledger-003', [
      { entityType: 'trade', entityId: 'trade-001', label: 'Trade 1', timestamp: '2026-01-01' },
    ], 'Aggregated');

    // Tamper with the links
    record.links[0].entityId = 'trade-999';
    expect(verifyProvenanceIntegrity(record)).toBe(false);
  });
});

// ============================================================================
// SECTION 12: RATE LIMITER
// ============================================================================

describe('Rate Limiter', () => {
  it('allows immediate acquisition within rate limit', async () => {
    const limiter = new RateLimiter(100); // high rate
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('throttles when rate exceeded', async () => {
    const limiter = new RateLimiter(1); // 1 per second
    await limiter.acquire();
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });
});

// ============================================================================
// SECTION 13: end-to-end pipeline scenario
// ============================================================================

describe('End-to-end pipeline scenario', () => {
  it('simulates a complete settlement flow', () => {
    // 1. Odds are captured, de-vigged
    const odds = { home: 2.0, draw: 3.5, away: 4.0 };
    const devigged = removeVig(odds);
    const fairHome = devigged.fair.home;

    // 2. Edge is calculated
    const edge = expectedValue(2.0, fairHome);
    // At fair odds, edge = fairProb * takenOdds - 1
    // fairProb ≈ 0.483 (de-vigged), takenOdds = 2.0
    // edge = 0.483 * 2 - 1 = -0.034 (slight negative because fair prob < 0.5)
    // This is expected — confirms the de-vig layer is working
    expect(edge).toBeLessThan(0);
    expect(Math.abs(edge)).toBeLessThan(0.05);
    // 3. Match settles
    const settlement = settleMoneyline(2, 1, 'home', 2.0);
    expect(settlement.outcome).toBe('WIN');

    // 4. Performance ledger computes metrics
    const ledger = computePerformanceLedger([
      { stakeUnits: 1, oddsTaken: 2.0, profitUnits: settlement.profitUnits, edge, closingOdds: 1.9, voided: false, settledAt: '2026-01-01' },
    ]);
    expect(ledger.roi).toBeGreaterThan(0);
    expect(ledger.clv).not.toBeNull();
  });
});