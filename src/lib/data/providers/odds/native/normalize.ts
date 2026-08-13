// Native OddsPAPI v4 → Application Normalized Odds Model
// Location: src/lib/data/providers/odds/native/normalize.ts
// Converts the verified OddsPAPI v4 response (fixture + bookmakerOdds) into the
// application's existing normalized odds model (OddsSnapshot) and the
// sharpOdds shape consumed by the T-60 snapshot pipeline.
//
// Rules:
//  - Market type is resolved from the live /v4/markets discovery by marketId;
//    unknown marketIds are skipped, never guessed.
//  - Lines are derived from bookmakerOutcomeId (e.g. "3.5/over", "0/under").
//    When no line is present (moneyline / 1X2), line = 0.
//  - A bookmaker is only normalized if its slug is in the verified set.
//  - Unknown markets/outcomes never crash the ingestion cycle — they are
//    skipped and counted.

import type { OddsSnapshot, MarketType } from '../../types';
import type {
  NativeOddsFixture,
  NativeBookmakerOdds,
  NativeBookmakerMarket,
  NativeOutcomePlayer,
} from './schemas';
import type { DiscoveredMarket } from './discovery';

export interface NormalizedSharpBookmakerMarket {
  key: string;
  outcomes: Array<{ name: string; price: number; point?: number }>;
}

export interface NormalizedSharpFixture {
  fixtureId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: Array<{
    key: string;
    title: string;
    lastUpdate: string | null;
    markets: NormalizedSharpBookmakerMarket[];
  }>;
}

export interface NormalizationStats {
  fixtures: number;
  snapshots: number;
  skippedUnknownMarkets: number;
  skippedUnknownOutcomes: number;
  skippedUnverifiedBookmakers: number;
  skippedNoPrice: number;
}

// Map a discovered market (from /v4/markets) to one of the four project
// market types. Resolution is by the marketType + marketName returned by the
// provider — nothing is hardcoded to a specific marketId.
export function classifyMarketType(market: DiscoveredMarket): MarketType | null {
  const type = market.marketType?.toLowerCase() ?? '';
  const name = market.marketName?.toLowerCase() ?? '';

  if (type === '1x2' || name.includes('full time result')) return 'moneyline';
  if (name.includes('both teams to score')) return 'btts';
  if (type === 'totals' || name.includes('over under')) return 'over_under';
  if (type === 'asian_handicap' || name.includes('asian handicap') || name.includes('handicap result')) {
    return 'asian_handicap';
  }
  return null;
}

// Parse "3.5/over", "0.5/under", "-1/home", "0/away" into { line, side }.
// Returns null when the label does not encode a line (e.g. moneyline outcomes).
export function parseBookmakerOutcomeLabel(label: string | null | undefined): {
  line: number;
  side: 'home' | 'away' | 'draw' | 'over' | 'under' | 'yes' | 'no' | null;
} | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\/(.+)$/);
  if (!match) return null;

  const line = parseFloat(match[1]);
  if (Number.isNaN(line)) return null;

  const sideRaw = match[2];
  let side: { line: number; side: 'home' | 'away' | 'draw' | 'over' | 'under' | 'yes' | 'no' | null }['side'] = null;
  if (sideRaw === 'home') side = 'home';
  else if (sideRaw === 'away') side = 'away';
  else if (sideRaw === 'draw') side = 'draw';
  else if (sideRaw === 'over') side = 'over';
  else if (sideRaw === 'under') side = 'under';
  else if (sideRaw === 'yes') side = 'yes';
  else if (sideRaw === 'no') side = 'no';

  return { line, side };
}

function firstPlayer(outcome: NativeBookmakerMarket['outcomes'][string]): NativeOutcomePlayer | null {
  const players = outcome?.players ?? {};
  const keys = Object.keys(players);
  if (keys.length === 0) return null;
  const player = players[keys[0]];
  if (!player || typeof player.price !== 'number' || player.price <= 0) return null;
  return player;
}

export interface NormalizeContext {
  verifiedBookmakerSlugs: Set<string>;
  marketsById: Map<number, DiscoveredMarket>;
}

/**
 * Normalize one OddsPAPI v4 fixture into the application OddsSnapshot model.
 * Only the four project markets and verified sharp bookmakers are kept.
 */
export function normalizeNativeFixture(
  fixture: NativeOddsFixture,
  ctx: NormalizeContext
): { snapshots: OddsSnapshot[]; stats: NormalizationStats } {
  const stats: NormalizationStats = {
    fixtures: 1,
    snapshots: 0,
    skippedUnknownMarkets: 0,
    skippedUnknownOutcomes: 0,
    skippedUnverifiedBookmakers: 0,
    skippedNoPrice: 0,
  };

  const snapshots: OddsSnapshot[] = [];
  const bookmakerOdds: Record<string, NativeBookmakerOdds> = fixture.bookmakerOdds ?? {};

  for (const [slug, bookmaker] of Object.entries(bookmakerOdds)) {
    if (!ctx.verifiedBookmakerSlugs.has(slug)) {
      stats.skippedUnverifiedBookmakers += 1;
      continue;
    }
    if (bookmaker.suspended === true) continue;

    const markets = bookmaker.markets ?? {};
    for (const [marketKey, market] of Object.entries(markets)) {
      if (market.marketActive === false) continue;

      const marketId = Number(marketKey);
      const discovered = Number.isFinite(marketId) ? ctx.marketsById.get(marketId) : undefined;
      const marketType = discovered ? classifyMarketType(discovered) : null;

      if (!discovered || !marketType) {
        stats.skippedUnknownMarkets += 1;
        continue;
      }

      // Collect outcome prices by side, using bookmakerOutcomeId labels where
      // available; fall back to outcome names from the market discovery.
      const prices: Record<string, number> = {};
      const lines: Record<string, number> = {};

      for (const [outcomeKey, outcome] of Object.entries(market.outcomes ?? {})) {
        const player = firstPlayer(outcome);
        if (!player) {
          stats.skippedNoPrice += 1;
          continue;
        }

        const label = player.bookmakerOutcomeId ?? undefined;
        const parsed = parseBookmakerOutcomeLabel(label);

        // Determine side: prefer label side; else outcome name from discovery.
        let side: string | null = parsed?.side ?? null;
        if (!side && discovered) {
          const outcomeId = Number(outcomeKey);
          const discoveredOutcome = discovered.outcomes.find((o) => o.outcomeId === outcomeId);
          const outcomeName = discoveredOutcome?.outcomeName?.toLowerCase() ?? '';
          if (outcomeName === '1' || outcomeName === 'home') side = 'home';
          else if (outcomeName === 'x' || outcomeName === 'draw') side = 'draw';
          else if (outcomeName === '2' || outcomeName === 'away') side = 'away';
          else if (outcomeName === 'over') side = 'over';
          else if (outcomeName === 'under') side = 'under';
          else if (outcomeName === 'yes') side = 'yes';
          else if (outcomeName === 'no') side = 'no';
        }
        if (!side) {
          stats.skippedUnknownOutcomes += 1;
          continue;
        }

        prices[side] = player.price;
        if (parsed) lines[side] = parsed.line;
      }

      // Derive line for line-based markets from the outcome labels; fall back to
      // the discovered market handicap. Moneyline has no line (0).
      let line = 0;
      if (marketType === 'over_under' || marketType === 'asian_handicap') {
        const lineValues = Object.values(lines);
        line = lineValues.length > 0 ? lineValues[0] : (discovered.handicap ?? 0);
      }

      // Map to the application OddsSnapshot model.
      let priceHome = 0;
      let priceAway = 0;
      let priceDraw: number | null = null;

      if (marketType === 'moneyline') {
        priceHome = prices['home'] ?? 0;
        priceDraw = prices['draw'] ?? null;
        priceAway = prices['away'] ?? 0;
      } else if (marketType === 'over_under' || marketType === 'btts') {
        // over/under & btts: first side is "home" slot, second is "away" slot
        priceHome = prices['over'] ?? prices['yes'] ?? 0;
        priceAway = prices['under'] ?? prices['no'] ?? 0;
      } else if (marketType === 'asian_handicap') {
        priceHome = prices['home'] ?? 0;
        priceAway = prices['away'] ?? 0;
      }

      if (priceHome <= 0 && priceAway <= 0) {
        stats.skippedNoPrice += 1;
        continue;
      }

      snapshots.push({
        id: `native_${fixture.fixtureId}_${slug}_${marketKey}_${Date.now()}`,
        fixtureId: fixture.fixtureId,
        bookmaker: slug,
        marketType,
        line,
        priceHome,
        priceAway,
        priceDraw,
        capturedAt: new Date(),
        providerName: 'oddspapi',
        rawResponseHash: '',
      });
      stats.snapshots += 1;
    }
  }

  return { snapshots, stats };
}

/**
 * Normalize a full native odds response (array of fixtures) into the sharpOdds
 * shape consumed by the T-60 snapshot pipeline, plus the OddsSnapshot model.
 */
export function normalizeNativeOddsResponse(
  fixtures: NativeOddsFixture[],
  ctx: NormalizeContext
): { sharp: NormalizedSharpFixture[]; snapshots: OddsSnapshot[]; stats: NormalizationStats } {
  const stats: NormalizationStats = {
    fixtures: 0,
    snapshots: 0,
    skippedUnknownMarkets: 0,
    skippedUnknownOutcomes: 0,
    skippedUnverifiedBookmakers: 0,
    skippedNoPrice: 0,
  };
  const snapshots: OddsSnapshot[] = [];
  const sharp: NormalizedSharpFixture[] = [];

  for (const fixture of fixtures) {
    const normalized = normalizeNativeFixture(fixture, ctx);
    stats.fixtures += normalized.stats.fixtures;
    stats.snapshots += normalized.stats.snapshots;
    stats.skippedUnknownMarkets += normalized.stats.skippedUnknownMarkets;
    stats.skippedUnknownOutcomes += normalized.stats.skippedUnknownOutcomes;
    stats.skippedUnverifiedBookmakers += normalized.stats.skippedUnverifiedBookmakers;
    stats.skippedNoPrice += normalized.stats.skippedNoPrice;
    snapshots.push(...normalized.snapshots);

    // Build the sharp shape only when at least one snapshot exists for the fixture.
    if (normalized.snapshots.length === 0) continue;

    const byBookmaker = new Map<string, NormalizedSharpFixture['bookmakers'][number]>();
    for (const snap of normalized.snapshots) {
      let bk = byBookmaker.get(snap.bookmaker);
      if (!bk) {
        bk = { key: snap.bookmaker, title: snap.bookmaker, lastUpdate: null, markets: [] };
        byBookmaker.set(snap.bookmaker, bk);
      }
      const existing = bk.markets.find((m) => m.key === marketKeyFor(snap.marketType));
      const outcomeName = sideNameFor(snap.marketType);
      const outcome = {
        name: outcomeName,
        price: snap.priceHome || snap.priceAway || 0,
        point: snap.marketType === 'moneyline' ? undefined : snap.line,
      };
      if (existing) {
        existing.outcomes.push(outcome);
      } else {
        bk.markets.push({ key: marketKeyFor(snap.marketType), outcomes: [outcome] });
      }
    }

    sharp.push({
      fixtureId: fixture.fixtureId,
      sportKey: 'soccer',
      homeTeam: fixture.participant1Name ?? '',
      awayTeam: fixture.participant2Name ?? '',
      commenceTime: fixture.startTime,
      bookmakers: Array.from(byBookmaker.values()),
    });
  }

  return { sharp, snapshots, stats };
}

function marketKeyFor(marketType: MarketType): string {
  switch (marketType) {
    case 'moneyline': return 'h2h';
    case 'asian_handicap': return 'spreads';
    case 'over_under': return 'totals';
    case 'btts': return 'btts';
  }
}

function sideNameFor(marketType: MarketType): string {
  switch (marketType) {
    case 'moneyline': return 'Home';
    case 'over_under': return 'Over';
    case 'btts': return 'Yes';
    case 'asian_handicap': return 'Home';
  }
}
