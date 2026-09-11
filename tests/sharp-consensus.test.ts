import { describe, it, expect } from 'vitest';
import {
  SharpConsensusEngine,
  SharpConsensusError,
  deriveExchangeReferencePrice,
  compareModelToConsensus,
  computeRetailDivergence,
  type SharpQuote,
} from '@/lib/market-intelligence/sharpConsensus';
import { SharpReferenceProvider } from '@/lib/market-intelligence/sharpReferenceProvider';
import type { OddsSnapshot, MarketType } from '@/lib/data/providers/types';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const FRESH = NOW.toISOString();

function quote(
  source: string,
  selection: string,
  odds: number,
  overrides: Partial<SharpQuote> = {}
): SharpQuote {
  return {
    source,
    market: 'asian_handicap',
    line: -0.5,
    selection,
    odds,
    timestamp: FRESH,
    ...overrides,
  };
}

describe('SharpConsensusEngine — Sharp Market Reference Policy', () => {
  it('de-vigs each source through the canonical proportional method', () => {
    const result = SharpConsensusEngine.compute(
      [quote('pinnacle', 'home', 1.91), quote('pinnacle', 'away', 1.91)],
      { now: NOW }
    );

    expect(result.sharp_consensus_probability.home).toBeCloseTo(0.5, 6);
    expect(result.sharp_consensus_probability.away).toBeCloseTo(0.5, 6);
    expect(result.sharp_consensus_fair_odds.home).toBeCloseTo(2.0, 2);
    expect(result.s1_available).toBe(1);
    expect(result.s1_total).toBe(1);
    expect(result.source_quality).toBe('LOW');
    expect(result.warnings).toContain('LOW_SOURCE_DIVERSITY');
    // A single source cannot back a production-grade consensus.
    expect(result.dataState).toBe('INSUFFICIENT_DATA');
  });

  it('reaches HIGH quality when multiple S1 sources agree', () => {
    const result = SharpConsensusEngine.compute(
      [
        quote('pinnacle', 'home', 1.91),
        quote('pinnacle', 'away', 1.91),
        quote('sbobet', 'home', 1.91),
        quote('sbobet', 'away', 1.91),
      ],
      { now: NOW }
    );

    expect(result.s1_available).toBe(2);
    expect(result.source_quality).toBe('HIGH');
    expect(result.market_dispersion).toBeCloseTo(0, 6);
    expect(result.dataState).toBe('REAL');
  });

  it('never combines different lines (LINE PRESERVATION)', () => {
    expect(() =>
      SharpConsensusEngine.compute(
        [
          quote('pinnacle', 'home', 1.91),
          quote('pinnacle', 'away', 1.91),
          quote('sbobet', 'home', 1.85, { line: -0.75 }),
        ],
        { now: NOW }
      )
    ).toThrowError(SharpConsensusError);
  });

  it('skips incomplete books instead of guessing missing selections', () => {
    const result = SharpConsensusEngine.compute(
      [
        quote('pinnacle', 'home', 1.91),
        quote('pinnacle', 'away', 1.91),
        quote('sbobet', 'home', 1.85), // missing away
      ],
      { now: NOW }
    );

    expect(result.warnings).toContain('INCOMPLETE_BOOK:sbobet');
    expect(result.s1_available).toBe(1);
  });

  it('excludes stale quotes rather than blending them', () => {
    const stale = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const result = SharpConsensusEngine.compute(
      [
        quote('pinnacle', 'home', 1.91, { timestamp: stale }),
        quote('pinnacle', 'away', 1.91, { timestamp: stale }),
      ],
      { now: NOW }
    );

    expect(result.source_count).toBe(0);
    expect(result.warnings).toContain('STALE_SOURCE:pinnacle');
    expect(result.warnings).toContain('NO_USABLE_SOURCES');
    expect(result.dataState).toBe('INSUFFICIENT_DATA');
  });

  it('downweights secondary S2 sources relative to S1', () => {
    const result = SharpConsensusEngine.compute(
      [
        quote('pinnacle', 'home', 1.80),
        quote('pinnacle', 'away', 2.05),
        quote('marathonbet', 'home', 2.05),
        quote('marathonbet', 'away', 1.80),
      ],
      { now: NOW }
    );

    // Pinnacle (weight 1.0) must dominate Marathonbet (weight 0.4).
    const pinnacleFair = result.sources.find((s) => s.source === 'pinnacle')!.fair.home;
    const marathonFair = result.sources.find((s) => s.source === 'marathonbet')!.fair.home;
    const consensus = result.sharp_consensus_probability.home;
    expect(Math.abs(consensus - pinnacleFair)).toBeLessThan(Math.abs(consensus - marathonFair));
  });
});

describe('exchange reference pricing', () => {
  it('adjusts back prices for commission', () => {
    const derived = deriveExchangeReferencePrice({
      source: 'betfair_ex_eu',
      market: 'asian_handicap',
      line: -0.5,
      selection: 'home',
      odds: 2.0,
      timestamp: FRESH,
      exchange: { back: 2.0, commission: 0.02 },
    });

    // 1 + (2.0 - 1) * (1 - 0.02) = 1.98
    expect(derived.price).toBeCloseTo(1.98, 6);
    expect(derived.adjusted).toBe(true);
  });

  it('midpoints back and lay when both sides exist', () => {
    const derived = deriveExchangeReferencePrice({
      source: 'betfair_ex_eu',
      market: 'asian_handicap',
      line: -0.5,
      selection: 'home',
      odds: 2.0,
      timestamp: FRESH,
      exchange: { back: 2.0, lay: 2.1, commission: 0.02, liquidity: 500 },
    });

    // backEff = 1.98; layBackEquivalent = 1 + (2.1-1)/0.98 = 2.1224...
    expect(derived.price).toBeGreaterThan(1.98);
    expect(derived.price).toBeLessThan(2.1225);
    expect(derived.warnings).toHaveLength(0);
  });

  it('flags thin liquidity and wide spreads', () => {
    const derived = deriveExchangeReferencePrice({
      source: 'betfair_ex_eu',
      market: 'asian_handicap',
      line: -0.5,
      selection: 'home',
      odds: 2.0,
      timestamp: FRESH,
      exchange: { back: 2.0, lay: 2.5, commission: 0.02, liquidity: 10 },
    });

    expect(derived.warnings).toContain('THIN_EXCHANGE_LIQUIDITY');
    expect(derived.warnings).toContain('WIDE_EXCHANGE_SPREAD');
  });
});

describe('model vs market comparison helpers', () => {
  it('classifies model consensus differences in percentage points', () => {
    expect(compareModelToConsensus(0.578, 0.542).differencePp).toBeCloseTo(3.6, 6);
    expect(compareModelToConsensus(0.578, 0.542).direction).toBe('MODEL_HIGHER');
    expect(compareModelToConsensus(0.50, 0.505).direction).toBe('ALIGNED');
    expect(compareModelToConsensus(0.50, 0.56).direction).toBe('MODEL_LOWER');
  });

  it('classifies retail divergence without promoting it as an edge', () => {
    const divergence = computeRetailDivergence(2.2, 0.5);
    expect(divergence.divergencePp).toBeCloseTo(-4.55, 1);
    expect(divergence.classification).toBe('MODEL_EDGE');

    const aligned = computeRetailDivergence(2.0, 0.5);
    expect(aligned.classification).toBe('ALIGNED');

    const unavailable = computeRetailDivergence(null, null);
    expect(unavailable.classification).toBe('INSUFFICIENT_DATA');
  });
});

function snapshot(
  bookmaker: string,
  marketType: MarketType,
  line: number,
  priceHome: number,
  priceAway: number,
  priceDraw: number | null = null
): OddsSnapshot {
  return {
    id: `${bookmaker}-${marketType}-${line}`,
    fixtureId: 'fixture-1',
    bookmaker,
    marketType,
    line,
    priceHome,
    priceAway,
    priceDraw,
    capturedAt: NOW,
    providerName: 'oddspapi',
    rawResponseHash: 'hash',
  };
}

describe('SharpReferenceProvider — provider abstraction', () => {
  it('converts snapshots into per-source quotes and preserves lines', () => {
    const quotes = SharpReferenceProvider.toQuotes([
      snapshot('pinnacle', 'asian_handicap', -0.5, 1.91, 1.91),
      snapshot('sbobet', 'asian_handicap', -0.75, 1.85, 1.95),
    ]);

    expect(quotes).toHaveLength(4);
    expect(new Set(quotes.map((q) => q.line)).size).toBe(2);
    // No placeholder quotes for invalid prices.
    const invalid = SharpReferenceProvider.toQuotes([
      snapshot('pinnacle', 'asian_handicap', -0.5, 0, 1.91),
    ]);
    expect(invalid).toHaveLength(1);
  });

  it('reports dynamic source availability without fabricating sources', () => {
    const partial = SharpReferenceProvider.availability([
      snapshot('pinnacle', 'asian_handicap', -0.5, 1.91, 1.91),
    ]);
    expect(partial.s1_available).toBe(1);
    expect(partial.s1_total).toBeGreaterThanOrEqual(3);
    expect(partial.warnings).toContain('LOW_SOURCE_DIVERSITY');

    const none = SharpReferenceProvider.availability([]);
    expect(none.s1_available).toBe(0);
    expect(none.warnings).toContain('NO_S1_SOURCES');
  });

  it('computes consensus per market+line without merging lines', () => {
    const results = SharpReferenceProvider.consensusByMarketLine([
      snapshot('pinnacle', 'asian_handicap', -0.5, 1.91, 1.91),
      snapshot('sbobet', 'asian_handicap', -0.5, 1.91, 1.91),
      snapshot('pinnacle', 'asian_handicap', -0.75, 1.85, 1.95),
    ]);

    expect(results).toHaveLength(2);
    const half = results.find((r) => r.line === -0.5)!;
    expect(half.consensus.s1_available).toBe(2);
    expect(half.consensus.sharp_consensus_probability.home).toBeCloseTo(0.5, 6);
  });
});
