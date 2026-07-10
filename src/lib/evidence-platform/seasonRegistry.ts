/**
 * Sprint A1 — Season Registry
 * ============================
 * Centralized, strongly-typed registry of supported leagues and seasons.
 *
 * Responsibilities:
 *   - supported leagues
 *   - supported seasons
 *   - provider availability
 *   - season metadata
 *   - competition aliases
 *   - canonical IDs
 *   - promotion/relegation awareness
 *   - active/inactive seasons
 *
 * All lookups are strongly typed and return readonly data. The registry is
 * dependency-injected: pass leagues/seasons via the constructor, or rely on
 * the shipped defaults.
 */

import type {
  SupportedLeague,
  SeasonMetadata,
  SeasonQuery,
  ProviderAvailability,
} from './types';

const DEFAULT_LEAGUES: readonly SupportedLeague[] = [
  { canonicalId: 'comp:epl', name: 'English Premier League', shortName: 'EPL', country: 'England', tier: 1, timezone: 'Europe/London', aliases: ['premier league', 'epl', 'e0', 'england premier'], active: true, promotionRelegation: true },
  { canonicalId: 'comp:laliga', name: 'La Liga', shortName: 'La Liga', country: 'Spain', tier: 1, timezone: 'Europe/Madrid', aliases: ['la liga', 'laliga', 'primera division', 'sp1'], active: true, promotionRelegation: true },
  { canonicalId: 'comp:bundesliga', name: 'Bundesliga', shortName: 'BL1', country: 'Germany', tier: 1, timezone: 'Europe/Berlin', aliases: ['bundesliga', 'd1', 'german bundesliga'], active: true, promotionRelegation: true },
  { canonicalId: 'comp:seriea', name: 'Serie A', shortName: 'SA', country: 'Italy', tier: 1, timezone: 'Europe/Rome', aliases: ['serie a', 'seriea', 'i1', 'italy serie a'], active: true, promotionRelegation: true },
  { canonicalId: 'comp:ligue1', name: 'Ligue 1', shortName: 'L1', country: 'France', tier: 1, timezone: 'Europe/Paris', aliases: ['ligue 1', 'ligue1', 'f1', 'france ligue 1'], active: true, promotionRelegation: true },
  { canonicalId: 'comp:ucl', name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe', tier: 1, timezone: 'Europe/Zurich', aliases: ['champions league', 'ucl', 'cl'], active: true, promotionRelegation: false },
  { canonicalId: 'comp:wc', name: 'FIFA World Cup', shortName: 'WC', country: 'World', tier: 1, timezone: 'UTC', aliases: ['world cup', 'fifa world cup', 'wc'], active: false, promotionRelegation: false },
];

function buildSeasonId(leagueId: string, name: string): string {
  return `season:${leagueId.replace('comp:', '')}:${name}`;
}

/**
 * Generate a default season for a league covering startYear→startYear+1.
 * Provider availability defaults to football-data + api-football.
 */
function defaultSeason(league: SupportedLeague, startYear: number, active: boolean): SeasonMetadata {
  const name = `${startYear}-${startYear + 1}`;
  const providers: readonly ProviderAvailability[] = [
    { provider: 'football-data', available: true, coverageFrom: `${startYear}-08-01T00:00:00Z` },
    { provider: 'api-football', available: startYear >= 2016, coverageFrom: `${startYear}-08-01T00:00:00Z` },
  ];
  return {
    id: buildSeasonId(league.canonicalId, name),
    leagueId: league.canonicalId,
    name,
    startYear,
    endYear: startYear + 1,
    startDate: `${startYear}-08-01T00:00:00Z`,
    endDate: `${startYear + 1}-05-31T23:59:59Z`,
    active,
    providers,
    promotedTeams: [],
    relegatedTeams: [],
  };
}

export class SeasonRegistry {
  private readonly leagues: Map<string, SupportedLeague> = new Map();
  private readonly aliasIndex: Map<string, string> = new Map();
  private readonly seasons: Map<string, SeasonMetadata> = new Map();

  constructor(
    leagues: readonly SupportedLeague[] = DEFAULT_LEAGUES,
    seasons?: readonly SeasonMetadata[]
  ) {
    for (const league of leagues) {
      this.registerLeague(league);
    }
    if (seasons) {
      for (const season of seasons) this.registerSeason(season);
    } else {
      // Seed a reasonable default season window per active domestic league.
      for (const league of leagues) {
        if (!league.active) continue;
        for (let year = 2015; year <= 2024; year++) {
          this.registerSeason(defaultSeason(league, year, year === 2024));
        }
      }
    }
  }

  // ─── League APIs ───────────────────────────────────────────────────────

  registerLeague(league: SupportedLeague): void {
    this.leagues.set(league.canonicalId, league);
    this.aliasIndex.set(league.name.toLowerCase(), league.canonicalId);
    this.aliasIndex.set(league.shortName.toLowerCase(), league.canonicalId);
    for (const alias of league.aliases) {
      this.aliasIndex.set(alias.toLowerCase(), league.canonicalId);
    }
  }

  getLeague(canonicalId: string): SupportedLeague | undefined {
    return this.leagues.get(canonicalId);
  }

  /** Resolve any alias, short name, or canonical id to a league. */
  resolveLeague(value: string): SupportedLeague | null {
    const clean = value.toLowerCase().trim();
    if (this.leagues.has(value)) return this.leagues.get(value) ?? null;
    if (this.leagues.has(clean)) return this.leagues.get(clean) ?? null;
    const id = this.aliasIndex.get(clean);
    return id ? this.leagues.get(id) ?? null : null;
  }

  /** Resolve any alias to a canonical league id. */
  resolveCanonicalId(value: string): string | null {
    return this.resolveLeague(value)?.canonicalId ?? null;
  }

  getSupportedLeagues(activeOnly = false): readonly SupportedLeague[] {
    const all = Array.from(this.leagues.values());
    return activeOnly ? all.filter((l) => l.active) : all;
  }

  isLeagueSupported(value: string): boolean {
    return this.resolveLeague(value) !== null;
  }

  // ─── Season APIs ───────────────────────────────────────────────────────

  registerSeason(season: SeasonMetadata): void {
    this.seasons.set(season.id, season);
  }

  getSeason(id: string): SeasonMetadata | undefined {
    return this.seasons.get(id);
  }

  isSeasonSupported(id: string): boolean {
    return this.seasons.has(id);
  }

  getSeasonsForLeague(leagueId: string, activeOnly = false): readonly SeasonMetadata[] {
    const canonical = this.resolveCanonicalId(leagueId) ?? leagueId;
    return Array.from(this.seasons.values())
      .filter((s) => s.leagueId === canonical && (!activeOnly || s.active))
      .sort((a, b) => a.startYear - b.startYear);
  }

  /** Strongly-typed season query. */
  querySeasons(query: SeasonQuery = {}): readonly SeasonMetadata[] {
    const canonical = query.leagueId ? this.resolveCanonicalId(query.leagueId) ?? query.leagueId : undefined;
    return Array.from(this.seasons.values())
      .filter((s) => {
        if (canonical && s.leagueId !== canonical) return false;
        if (query.activeOnly && !s.active) return false;
        if (query.minStartYear !== undefined && s.startYear < query.minStartYear) return false;
        if (query.maxEndYear !== undefined && s.endYear > query.maxEndYear) return false;
        if (query.provider) {
          const p = s.providers.find((pv) => pv.provider === query.provider);
          if (!p || !p.available) return false;
        }
        return true;
      })
      .sort((a, b) => (a.leagueId === b.leagueId ? a.startYear - b.startYear : a.leagueId.localeCompare(b.leagueId)));
  }

  /** Provider availability for a specific season. */
  getProviderAvailability(seasonId: string): readonly ProviderAvailability[] {
    return this.seasons.get(seasonId)?.providers ?? [];
  }

  isProviderAvailable(seasonId: string, provider: string): boolean {
    const p = this.getProviderAvailability(seasonId).find((pv) => pv.provider === provider);
    return p?.available ?? false;
  }

  getActiveSeasons(): readonly SeasonMetadata[] {
    return Array.from(this.seasons.values()).filter((s) => s.active);
  }

  getStatistics(): { leagues: number; activeLeagues: number; seasons: number; activeSeasons: number } {
    const leagues = Array.from(this.leagues.values());
    const seasons = Array.from(this.seasons.values());
    return {
      leagues: leagues.length,
      activeLeagues: leagues.filter((l) => l.active).length,
      seasons: seasons.length,
      activeSeasons: seasons.filter((s) => s.active).length,
    };
  }
}

export const defaultSeasonRegistry = new SeasonRegistry();
