// Native OddsPAPI v4 Provider
// Location: src/lib/data/providers/odds/native/provider.ts
// IOddsProvider implementation backed by the native OddsPAPI v4 adapter.
// Fetches pre-match odds via GET /v4/odds-by-tournaments (batch) and exposes
// a granular provider status taxonomy:
//
//   HEALTHY        — valid auth + real odds successfully normalized
//   INVALID_KEY    — 401 from OddsPAPI
//   RATE_LIMITED   — 429 from OddsPAPI
//   NO_ODDS        — valid response, but no eligible odds normalized
//   DEGRADED       — 404 / contract error
//   PARSING_ERROR  — schema/normalization failure
//   QUOTA          — local quota manager blocked the call
//   UNKNOWN        — network or unclassified failure

import { logger } from '@/lib/logger';
import { z } from 'zod';
import type {
  IOddsProvider,
  OddsSnapshot,
  ProviderOddsQuery,
  HealthStatus,
  NormalizedMarket,
} from '../../types';
import { createNativeOddsClient, type NativeOddsClient, OddsPapiError } from './client';
import { OddsPapiDiscovery, APPROVED_SHARP_BOOKMAKER_NAMES } from './discovery';
import { normalizeNativeOddsResponse, type NormalizedSharpFixture, type NormalizationStats } from './normalize';
import { NativeOddsResponseSchema } from './schemas';

const log = logger.child('provider:oddspapi:native');

export type OddsProviderStatus =
  | 'HEALTHY'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'NO_ODDS'
  | 'DEGRADED'
  | 'PARSING_ERROR'
  | 'QUOTA'
  | 'UNKNOWN';

export interface OddsProviderStatusDetail {
  status: OddsProviderStatus;
  fixtureCount: number;
  snapshotCount: number;
  verifiedBookmakers: string[];
  unavailableBookmakers: string[];
  marketIds: number[];
  error?: string;
  httpStatus?: number;
  errorCode?: string;
}

// Priority of tournament selection: verified league names preferred.
const PREFERRED_TOURNAMENT_KEYWORDS = [
  'premier league',
  'champions league',
  'la liga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'eredivisie',
  'primeira liga',
  'championship',
  'liga 1',
  'j1 league',
  'k league',
];

export class OddsPapiV4Provider implements IOddsProvider {
  readonly name = 'oddspapi';
  private client: NativeOddsClient;
  private discovery: OddsPapiDiscovery;

  constructor(client?: NativeOddsClient, discovery?: OddsPapiDiscovery) {
    this.client = client ?? createNativeOddsClient();
    this.discovery = discovery ?? new OddsPapiDiscovery(this.client);
  }

  /**
   * Select tournaments to fetch odds for. Prefers whitelist leagues with
   * upcoming fixtures; falls back to any tournament with upcoming fixtures.
   */
  private async selectTournaments(limit = 5): Promise<Array<{ tournamentId: number; name: string }>> {
    const tournaments = await this.discovery.getSoccerTournaments();
    const withFixtures = tournaments.filter((t) => t.tournamentId > 0);

    const ranked = withFixtures
      .map((t) => {
        const name = t.tournamentName.toLowerCase();
        const idx = PREFERRED_TOURNAMENT_KEYWORDS.findIndex((k) => name.includes(k));
        return { tournamentId: t.tournamentId, name: t.tournamentName, rank: idx === -1 ? 999 : idx };
      })
      .sort((a, b) => a.rank - b.rank);

    return ranked.slice(0, limit);
  }

  /**
   * Fetch and normalize pre-match odds for the eligible tournaments.
   */
  async fetchNormalizedOdds(): Promise<{
    sharp: NormalizedSharpFixture[];
    snapshots: OddsSnapshot[];
    stats: NormalizationStats;
    tournaments: Array<{ tournamentId: number; name: string }>;
  }> {
    const [bookmakerResult, markets, tournaments] = await Promise.all([
      this.discovery.getVerifiedSharpBookmakers(),
      this.discovery.getSoccerMarkets(),
      this.selectTournaments(),
    ]);

    if (bookmakerResult.verified.length === 0) {
      throw new OddsPapiError('CONTRACT_ERROR', 'bookmakers', 'No verified sharp bookmakers found in /v4/bookmakers');
    }

    if (tournaments.length === 0) {
      return { sharp: [], snapshots: [], stats: emptyStats(), tournaments: [] };
    }

    const tournamentIds = tournaments.map((t) => t.tournamentId).join(',');

    // NOTE: the live API rejects both a comma-separated `bookmakers` param AND
    // an omitted param ("Invalid number of bookmakers specified. Please provide
    // exactly one bookmaker using the 'bookmaker' query parameter."). The
    // contract is exactly ONE bookmaker per request, so we issue one request
    // per verified sharp slug (quota: 1 request per verified bookmaker per
    // cycle) and merge the results.
    const fixturesByBookmaker: Array<{
      slug: string;
      fixtures: Array<z.infer<typeof NativeOddsResponseSchema> extends Array<infer F> ? F : never>;
    }> = [];

    for (const bookmaker of bookmakerResult.verified) {
      const res = await this.client.get(
        '/odds-by-tournaments',
        {
          tournamentIds,
          bookmaker: bookmaker.slug,
          oddsFormat: 'decimal',
          language: 'en',
        },
        NativeOddsResponseSchema,
        'odds-by-tournaments'
      );
      const fixtures = Array.isArray(res.data) ? res.data : [res.data];
      fixturesByBookmaker.push({ slug: bookmaker.slug, fixtures: fixtures as any });
    }

    // Merge per-bookmaker responses by fixtureId, combining bookmakerOdds so a
    // fixture appears once with all its verified bookmakers' odds.
    const merged = new Map<string, any>();
    for (const group of fixturesByBookmaker) {
      for (const fixture of group.fixtures as any[]) {
        const existing = merged.get(fixture.fixtureId);
        if (!existing) {
          merged.set(fixture.fixtureId, { ...fixture, bookmakerOdds: { ...(fixture.bookmakerOdds ?? {}) } });
        } else {
          existing.bookmakerOdds = { ...existing.bookmakerOdds, ...(fixture.bookmakerOdds ?? {}) };
        }
      }
    }
    const fixtures = Array.from(merged.values());

    const ctx = {
      verifiedBookmakerSlugs: new Set(bookmakerResult.verified.map((b) => b.slug)),
      marketsById: new Map(markets.map((m) => [m.marketId, m])),
    };

    const normalized = normalizeNativeOddsResponse(fixtures, ctx);
    return { ...normalized, tournaments };
  }

  // ─── IOddsProvider implementation ───────────────────────────────────

  async fetchOdds(query: ProviderOddsQuery): Promise<OddsSnapshot[]> {
    const { snapshots } = await this.fetchNormalizedOdds();

    if (query.fixtureIds && query.fixtureIds.length > 0) {
      const idSet = new Set(query.fixtureIds);
      return snapshots.filter((s) => idSet.has(s.fixtureId));
    }
    return snapshots;
  }

  normalizeMarket(snapshot: OddsSnapshot): NormalizedMarket {
    const { priceHome, priceAway, priceDraw, line } = snapshot;
    if (priceHome <= 0 || priceAway <= 0) {
      throw new Error(`Invalid odds prices for ${snapshot.fixtureId}: ${priceHome}/${priceAway}`);
    }

    let margin: number;
    let homeProb: number;
    let awayProb: number;
    let drawProb: number | null = null;

    if (priceDraw !== null && priceDraw > 0) {
      margin = 1 / priceHome + 1 / priceAway + 1 / priceDraw - 1;
      const sumInv = 1 / priceHome + 1 / priceAway + 1 / priceDraw;
      homeProb = 1 / priceHome / sumInv;
      awayProb = 1 / priceAway / sumInv;
      drawProb = 1 / priceDraw / sumInv;
    } else {
      margin = 1 / priceHome + 1 / priceAway - 1;
      const sumInv = 1 / priceHome + 1 / priceAway;
      homeProb = 1 / priceHome / sumInv;
      awayProb = 1 / priceAway / sumInv;
    }

    return {
      marketType: snapshot.marketType,
      line,
      homeProb,
      awayProb,
      drawProb,
      homeOdds: priceHome,
      awayOdds: priceAway,
      drawOdds: priceDraw,
      vig: margin,
    };
  }

  async healthCheck(): Promise<boolean> {
    const status = await this.getProviderStatus();
    return status.status === 'HEALTHY';
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const detail = await this.getProviderStatus();
    return {
      healthy: detail.status === 'HEALTHY',
      provider: this.name,
      error: detail.error,
      lastChecked: new Date(),
    };
  }

  /**
   * Full provider status with granular taxonomy (see header). Uses the native
   * batch odds flow so HEALTHY strictly means real odds were normalized.
   */
  async getProviderStatus(): Promise<OddsProviderStatusDetail> {
    try {
      const { sharp, snapshots, stats, tournaments } = await this.fetchNormalizedOdds();

      const [bookmakerResult, markets] = await Promise.all([
        this.discovery.getVerifiedSharpBookmakers(),
        this.discovery.getSoccerMarkets(),
      ]);

      if (snapshots.length === 0) {
        return {
          status: 'NO_ODDS',
          fixtureCount: sharp.length,
          snapshotCount: 0,
          verifiedBookmakers: bookmakerResult.verified.map((b) => b.slug),
          unavailableBookmakers: bookmakerResult.unavailable,
          marketIds: markets.map((m) => m.marketId),
          error: `No eligible odds normalized (fixtures=${sharp.length}, tournaments=${tournaments.length})`,
        };
      }

      return {
        status: 'HEALTHY',
        fixtureCount: sharp.length,
        snapshotCount: snapshots.length,
        verifiedBookmakers: bookmakerResult.verified.map((b) => b.slug),
        unavailableBookmakers: bookmakerResult.unavailable,
        marketIds: markets.map((m) => m.marketId),
      };
    } catch (err) {
      if (err instanceof OddsPapiError) {
        return {
          status: mapErrorKindToStatus(err.kind),
          fixtureCount: 0,
          snapshotCount: 0,
          verifiedBookmakers: [],
          unavailableBookmakers: [],
          marketIds: [],
          error: err.message,
          httpStatus: err.httpStatus,
          errorCode: err.errorCode,
        };
      }
      log.error('provider_status_unexpected_error', { error: err instanceof Error ? err.message : String(err) });
      return {
        status: 'UNKNOWN',
        fixtureCount: 0,
        snapshotCount: 0,
        verifiedBookmakers: [],
        unavailableBookmakers: [],
        marketIds: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  getApprovedBookmakerNames(): string[] {
    return APPROVED_SHARP_BOOKMAKER_NAMES;
  }
}

function emptyStats(): NormalizationStats {
  return {
    fixtures: 0,
    snapshots: 0,
    skippedUnknownMarkets: 0,
    skippedUnknownOutcomes: 0,
    skippedUnverifiedBookmakers: 0,
    skippedNoPrice: 0,
  };
}

function mapErrorKindToStatus(kind: OddsPapiError['kind']): OddsProviderStatus {
  switch (kind) {
    case 'INVALID_KEY': return 'INVALID_KEY';
    case 'RATE_LIMITED': return 'RATE_LIMITED';
    case 'QUOTA': return 'QUOTA';
    case 'CONTRACT_ERROR': return 'DEGRADED';
    case 'PARSING_ERROR': return 'PARSING_ERROR';
    case 'NETWORK': return 'UNKNOWN';
  }
}

export const oddsPapiV4Provider = new OddsPapiV4Provider();
