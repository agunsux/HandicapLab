// ============================================================================
// SHARP REFERENCE PROVIDER
// ============================================================================
// Provider abstraction required by the Sharp Market Reference Policy (§11):
// the prediction engine must not depend directly on Pinnacle/SBO/Betfair.
//
//   OddsPapi (per-book snapshots)
//          ↓
//   SharpReferenceProvider  (this module)
//          ↓
//   SharpConsensusEngine
//          ↓
//   Probability / Market Comparison
//
// Sources are never fabricated: missing books reduce availability and source
// quality, and are reported explicitly.

import type { OddsSnapshot, MarketType } from '@/lib/data/providers/types';
import { getSharpBookConfig, getSharpBooksByTier, type SharpTier } from '@/lib/config/sharpBooks';
import {
  SharpConsensusEngine,
  type SharpConsensusOptions,
  type SharpConsensusResult,
  type SharpQuote,
} from './sharpConsensus';

export interface SharpReferenceAvailability {
  s1_available: number;
  s1_total: number;
  s2_available: number;
  s2_total: number;
  warnings: string[];
}

export interface SharpFixtureConsensus {
  fixtureId: string;
  market: MarketType;
  line: number;
  consensus: SharpConsensusResult;
}

function countTier(present: Set<string>, tier: SharpTier): number {
  let count = 0;
  for (const source of present) {
    if ((getSharpBookConfig(source)?.tier ?? 'S2') === tier) count += 1;
  }
  return count;
}

export class SharpReferenceProvider {
  static readonly s1Total: number = getSharpBooksByTier('S1').length;
  static readonly s2Total: number = getSharpBooksByTier('S2').length;

  /**
   * Convert normalized odds snapshots into per-source quotes. A quote is only
   * emitted when a real price (> 1.0) exists — never a placeholder.
   */
  static toQuotes(snapshots: OddsSnapshot[]): SharpQuote[] {
    const quotes: SharpQuote[] = [];

    for (const snap of snapshots) {
      const timestamp =
        snap.capturedAt instanceof Date
          ? snap.capturedAt.toISOString()
          : new Date(snap.capturedAt).toISOString();

      const push = (selection: string, odds: number) => {
        if (!Number.isFinite(odds) || odds <= 1) return;
        quotes.push({
          source: snap.bookmaker,
          market: snap.marketType,
          line: snap.line,
          selection,
          odds,
          timestamp,
        });
      };

      switch (snap.marketType) {
        case 'moneyline':
          push('home', snap.priceHome);
          if (snap.priceDraw != null) push('draw', snap.priceDraw);
          push('away', snap.priceAway);
          break;
        case 'asian_handicap':
          push('home', snap.priceHome);
          push('away', snap.priceAway);
          break;
        case 'over_under':
          push('over', snap.priceHome);
          push('under', snap.priceAway);
          break;
        case 'btts':
          push('yes', snap.priceHome);
          push('no', snap.priceAway);
          break;
      }
    }

    return quotes;
  }

  /**
   * Compute consensus for every market+line group present in the snapshot set.
   * Lines are preserved as distinct books (never merged).
   */
  static consensusByMarketLine(
    snapshots: OddsSnapshot[],
    options: SharpConsensusOptions = {}
  ): SharpFixtureConsensus[] {
    const groups = new Map<string, SharpQuote[]>();

    for (const quote of this.toQuotes(snapshots)) {
      const key = `${quote.market}|${quote.line}`;
      const list = groups.get(key) ?? [];
      list.push(quote);
      groups.set(key, list);
    }

    const results: SharpFixtureConsensus[] = [];
    for (const [key, quotes] of groups.entries()) {
      try {
        const consensus = SharpConsensusEngine.compute(quotes, options);
        results.push({
          fixtureId: snapshots[0]?.fixtureId ?? '',
          market: quotes[0].market,
          line: quotes[0].line,
          consensus,
        });
      } catch (err) {
        // A malformed group must not fabricate a consensus.
        console.warn(`[SharpReferenceProvider] consensus skipped for ${key}:`, err);
      }
    }

    return results;
  }

  /**
   * Dynamic source availability (Policy §12): report S1/S2 availability and
   * downgrade quality when sources are missing. Never substitutes fake data.
   */
  static availability(snapshots: OddsSnapshot[]): SharpReferenceAvailability {
    const present = new Set(snapshots.map((s) => s.bookmaker));
    const s1Available = countTier(present, 'S1');
    const s2Available = countTier(present, 'S2');
    const warnings: string[] = [];

    if (s1Available === 0) warnings.push('NO_S1_SOURCES');
    else if (s1Available === 1) warnings.push('LOW_SOURCE_DIVERSITY');
    if (s1Available < this.s1Total) warnings.push(`S1_SOURCES_AVAILABLE:${s1Available}/${this.s1Total}`);
    if (s2Available < this.s2Total) warnings.push(`S2_SOURCES_AVAILABLE:${s2Available}/${this.s2Total}`);

    return {
      s1_available: s1Available,
      s1_total: this.s1Total,
      s2_available: s2Available,
      s2_total: this.s2Total,
      warnings,
    };
  }
}
