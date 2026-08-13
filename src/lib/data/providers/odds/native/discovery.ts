// Native OddsPAPI v4 Discovery
// Location: src/lib/data/providers/odds/native/discovery.ts
// Discovers static metadata (sports, tournaments, bookmakers, markets) from the
// live OddsPAPI v4 API and caches it for the process lifetime so it is not
// re-fetched during every match cycle. All requests go through the quota-aware
// native client. Nothing here is hardcoded: sportId, tournamentIds, bookmaker
// slugs and marketIds are resolved from live responses.

import { logger } from '@/lib/logger';
import { createNativeOddsClient, type NativeOddsClient } from './client';
import {
  NativeBookmakersResponseSchema,
  NativeMarketsResponseSchema,
  NativeSportsResponseSchema,
  NativeTournamentsResponseSchema,
} from './schemas';

const log = logger.child('oddsapi:native:discovery');

export const SOCCER_SPORT_ID = 10; // verified: GET /v4/sports -> sportId 10 = soccer

// Project-approved sharp bookmaker names (product policy). Actual slugs are
// resolved from GET /v4/bookmakers — never assumed.
export const APPROVED_SHARP_BOOKMAKER_NAMES = ['Pinnacle', 'Circa', 'SBO'];

export interface DiscoveredMarket {
  marketId: number;
  marketName: string;
  marketType: string;
  handicap: number;
  outcomes: Array<{ outcomeId: number; outcomeName: string }>;
}

export interface DiscoveryResult {
  sportId: number;
  tournaments: Array<{
    tournamentId: number;
    tournamentSlug: string;
    tournamentName: string;
    categoryName: string;
  }>;
  bookmakers: Array<{ slug: string; name: string }>;
  markets: DiscoveredMarket[];
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — static metadata
const cache: Record<string, CacheEntry<unknown>> = {};

function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const entry = cache[key];
  if (entry && entry.expiresAt > Date.now()) {
    return Promise.resolve(entry.value as T);
  }
  return loader().then((value) => {
    cache[key] = { value, expiresAt: Date.now() + ttlMs };
    return value;
  });
}

export class OddsPapiDiscovery {
  private client: NativeOddsClient;

  constructor(client?: NativeOddsClient) {
    this.client = client ?? createNativeOddsClient();
  }

  /**
   * Resolve the soccer sport id from the live /v4/sports response.
   */
  async getSoccerSportId(): Promise<number> {
    return cached('sports', TTL_MS, async () => {
      const res = await this.client.get('/sports', { language: 'en' }, NativeSportsResponseSchema);
      const soccer = res.data.find((s) => s.slug === 'soccer' || s.sportId === SOCCER_SPORT_ID);
      if (!soccer) {
        throw new Error('SOCCER_SPORT_NOT_FOUND: /v4/sports response did not include soccer');
      }
      return soccer.sportId;
    });
  }

  /**
   * Discover all soccer tournaments (leagues) from /v4/tournaments.
   */
  async getSoccerTournaments(): Promise<DiscoveryResult['tournaments']> {
    const sportId = await this.getSoccerSportId();
    return cached(`tournaments:${sportId}`, TTL_MS, async () => {
      const res = await this.client.get(
        '/tournaments',
        { sportId: String(sportId), language: 'en' },
        NativeTournamentsResponseSchema
      );
      return res.data.map((t) => ({
        tournamentId: t.tournamentId,
        tournamentSlug: t.tournamentSlug,
        tournamentName: t.tournamentName,
        categoryName: t.categoryName,
      }));
    });
  }

  /**
   * Discover bookmakers from /v4/bookmakers and resolve the actual slugs for
   * the project-approved sharp bookmakers (by NAME, never by guess).
   */
  async getVerifiedSharpBookmakers(): Promise<{
    verified: Array<{ slug: string; name: string }>;
    unavailable: string[];
  }> {
    return cached('bookmakers', TTL_MS, async () => {
      const res = await this.client.get('/bookmakers', {}, NativeBookmakersResponseSchema);
      const all = res.data;

      const verified: Array<{ slug: string; name: string }> = [];
      const unavailable: string[] = [];

      for (const approved of APPROVED_SHARP_BOOKMAKER_NAMES) {
        const match = all.find(
          (b) => b.bookmakerName.toLowerCase() === approved.toLowerCase()
        );
        if (match) {
          verified.push({ slug: match.slug, name: match.bookmakerName });
        } else {
          unavailable.push(approved);
          log.warn('approved_bookmaker_not_found', { name: approved });
        }
      }

      return { verified, unavailable };
    });
  }

  /**
   * Discover markets from /v4/markets and select the ones relevant to the four
   * project markets. Market IDs are resolved from the live response — nothing
   * is hardcoded. Unknown/absent markets (e.g. Asian Handicap) are simply not
   * included, never guessed.
   */
  async getSoccerMarkets(): Promise<DiscoveredMarket[]> {
    const sportId = await this.getSoccerSportId();
    return cached(`markets:${sportId}`, TTL_MS, async () => {
      const res = await this.client.get('/markets', { language: 'en' }, NativeMarketsResponseSchema);
      return res.data
        .filter((m) => m.sportId === sportId && !m.playerProp)
        .map((m) => ({
          marketId: m.marketId,
          marketName: m.marketName,
          marketType: m.marketType,
          handicap: m.handicap,
          outcomes: m.outcomes.map((o) => ({ outcomeId: o.outcomeId, outcomeName: o.outcomeName })),
        }));
    });
  }

  /**
   * Full discovery snapshot (used for diagnostics and wiring).
   */
  async discoverAll(): Promise<DiscoveryResult> {
    const [sportId, tournaments, bookmakerResult, markets] = await Promise.all([
      this.getSoccerSportId(),
      this.getSoccerTournaments(),
      this.getVerifiedSharpBookmakers(),
      this.getSoccerMarkets(),
    ]);
    return {
      sportId,
      tournaments,
      bookmakers: bookmakerResult.verified,
      markets,
    };
  }

  /** Test hook: clears the metadata cache. */
  clearCache(): void {
    for (const key of Object.keys(cache)) delete cache[key];
  }
}

export const oddsPapiDiscovery = new OddsPapiDiscovery();
