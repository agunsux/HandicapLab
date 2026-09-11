// ============================================================================
// CANONICAL GLOBAL LEAGUE REGISTRY & DYNAMIC CLASSIFICATION
// ============================================================================
// Single source of truth for the worldwide football competition universe
// discovered live from API-Football Custom1500.
//
// Invariants:
//   - No hardcoded "best leagues" list. Classification is 100% data-driven.
//   - Real provider data only: never fabricate leagues, seasons, or odds coverage.
//   - Preserves canonical IDs (API-Football league_id) and existing caller interfaces.
//   - Explicit unknown states: UNKNOWN is never converted to AVAILABLE.
//   - All discovery requests route through ProviderGateway + QuotaManagerV4.

import { supabase } from '@/lib/supabase.server';
import { acquire, logCall } from '@/lib/providers/quotaManager';
import { apiFootballClient, type ApiFootballLeagueItem } from '@/lib/apis/apifootball';

// ─── Classification & Coverage Types ──────────────────────────────────────────

export type LeagueTier =
  | 'CORE'
  | 'HIGH_VALUE'
  | 'RESEARCH'
  | 'LOW_LIQUIDITY'
  | 'LIMITED_DATA'
  | 'UNSUPPORTED';

export type HistoricalDepth =
  | 'UNKNOWN'
  | '<1_SEASON'
  | '1_2_SEASONS'
  | '3_4_SEASONS'
  | '5_PLUS'
  | '7_PLUS';

export type MarketCoverageState =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'UNKNOWN'
  | 'UNAVAILABLE';

export type CoverageStatus =
  | 'FULL'
  | 'PARTIAL'
  | 'MINIMAL'
  | 'UNKNOWN'
  | 'UNSUPPORTED';

export interface PredictabilityHook {
  brier_score: number | null;
  clv_edge: number | null;
  sample_size: number;
  last_evaluated: string | null;
}

export type LeagueIngestionState =
  | 'DISCOVERED'
  | 'ELIGIBLE'
  | 'QUEUED'
  | 'INGESTING'
  | 'PARTIAL'
  | 'RESEARCH_READY'
  | 'STALE'
  | 'FAILED'
  | 'UNAVAILABLE';

export interface MarketReadiness {
  RESULT_READY: boolean;
  AH_READY: boolean;
  OU_READY: boolean;
  BTTS_READY: boolean;
  ML_READY: boolean;
}

export interface GlobalLeague {
  league_id: number;
  name: string;
  league_name: string;
  country: string;
  country_code: string | null;
  type: 'league' | 'cup';
  season: number;
  seasons_available: number;
  all_seasons: number[];
  coverage_status: CoverageStatus;
  historical_depth: HistoricalDepth;
  fixture_count: number | 'UNKNOWN';
  odds_availability: MarketCoverageState;
  market_availability: {
    AH: MarketCoverageState;
    OU: MarketCoverageState;
    BTTS: MarketCoverageState;
    ML: MarketCoverageState;
  };
  predictability_hooks: {
    AH: PredictabilityHook | null;
    OU: PredictabilityHook | null;
    BTTS: PredictabilityHook | null;
    ML: PredictabilityHook | null;
  };
  data_quality_score: number; // 0-100 based on verified metadata completeness
  priority_score: number;     // 0-100 calculated from objective data formula
  tier: LeagueTier;
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  provider: 'apifootball';
  provider_status: 'ACTIVE' | 'ARCHIVED';
  logo?: string;
  ingestion_status: LeagueIngestionState;
  last_ingested: string | null;
  market_readiness: MarketReadiness;
}

export interface LeagueCoverageMatrixItem {
  league: string;
  country: string;
  league_id: number;
  seasons_available: number;
  historical_depth: HistoricalDepth;
  fixture_coverage: string;
  AH_coverage: MarketCoverageState;
  OU_coverage: MarketCoverageState;
  BTTS_coverage: MarketCoverageState;
  ML_coverage: MarketCoverageState;
  odds_coverage: MarketCoverageState;
  data_quality: number;
  priority: number;
  tier: LeagueTier;
  status: string;
  fixture_count: number | 'UNKNOWN';
  ingestion_status: LeagueIngestionState;
  last_ingested: string | null;
  market_readiness: MarketReadiness;
}

// ─── Legacy Compatibility Types & Interfaces ──────────────────────────────────

export interface LeaguePriority {
  apiFootballId: number;
  name: string;
  country: string;
  tier: number;
  season: number;
  varSeason?: number;
}

export interface ProviderLeague {
  id: number;
  name: string;
  country: string;
  type: 'league' | 'cup';
  season: number;
  logo?: string;
}

// ─── Dynamic Classification Logic ─────────────────────────────────────────────

/**
 * Calculates historical depth without fabricating missing data.
 */
export function calculateHistoricalDepth(seasonsCount: number): HistoricalDepth {
  if (typeof seasonsCount !== 'number' || isNaN(seasonsCount) || seasonsCount < 0) return 'UNKNOWN';
  if (seasonsCount === 0) return '<1_SEASON';
  if (seasonsCount >= 1 && seasonsCount <= 2) return '1_2_SEASONS';
  if (seasonsCount >= 3 && seasonsCount <= 4) return '3_4_SEASONS';
  if (seasonsCount >= 5 && seasonsCount <= 6) return '5_PLUS';
  if (seasonsCount >= 7) return '7_PLUS';
  return 'UNKNOWN';
}

/**
 * Classifies a raw API-Football competition into canonical GlobalLeague metadata.
 * Strictly uses provider evidence — never assigns HIGH_VALUE based on reputation.
 */
export function classifyLeague(raw: ApiFootballLeagueItem): GlobalLeague {
  const leagueId = raw.league.id;
  const leagueName = raw.league.name || 'Unknown League';
  const rawType = (raw.league.type || '').toLowerCase();
  const isCup = rawType === 'cup' || /cup|trophy|pokal|coppa|copa|shield|super cup/i.test(leagueName);
  const type: 'league' | 'cup' = isCup ? 'cup' : 'league';

  const country = raw.country?.name ?? 'Unknown';
  const countryCode = raw.country?.code ?? null;

  const rawSeasons = raw.seasons ?? [];
  const seasonsAvailable = rawSeasons.length;
  const allSeasons = rawSeasons.map((s) => s.year).sort((a, b) => a - b);

  const currentSeasonObj =
    rawSeasons.find((s) => s.current) ??
    (rawSeasons.length > 0 ? rawSeasons[rawSeasons.length - 1] : undefined);
  const currentSeason = currentSeasonObj?.year ?? new Date().getFullYear();

  const historicalDepth = calculateHistoricalDepth(seasonsAvailable);

  // Coverage evaluation from latest season coverage object
  const cov = currentSeasonObj?.coverage;
  let coverageStatus: CoverageStatus = 'UNKNOWN';
  let oddsAvailability: MarketCoverageState = 'UNKNOWN';

  if (cov) {
    const hasFixtures = Boolean(cov.fixtures?.events || cov.fixtures?.lineups);
    const hasStats = Boolean(cov.fixtures?.statistics_fixtures);
    const hasStandings = Boolean(cov.standings);
    const hasOdds = Boolean(cov.odds);

    if (hasOdds) {
      // Evidence of odds availability from API-Football catalog
      oddsAvailability = 'PARTIAL';
    } else {
      oddsAvailability = 'UNAVAILABLE';
    }

    if (isCup) {
      coverageStatus = 'UNSUPPORTED';
    } else if (hasFixtures && hasStats && hasStandings && hasOdds) {
      coverageStatus = 'FULL';
    } else if (hasFixtures && (hasStats || hasStandings)) {
      coverageStatus = 'PARTIAL';
    } else if (hasFixtures) {
      coverageStatus = 'MINIMAL';
    } else {
      coverageStatus = 'UNKNOWN';
    }
  } else {
    coverageStatus = isCup ? 'UNSUPPORTED' : 'UNKNOWN';
    oddsAvailability = 'UNKNOWN';
  }

  // Market availability states (explicitly tied to verified provider evidence):
  // When odds catalog indicates odds (PARTIAL), specific sub-market lines (AH, OU, BTTS, ML)
  // remain UNKNOWN until verified via fixture-level odds ingestion.
  // If catalog explicitly indicates no odds (UNAVAILABLE), sub-markets are UNAVAILABLE.
  const subMarketState: MarketCoverageState =
    oddsAvailability === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'UNKNOWN';

  const marketAvailability: GlobalLeague['market_availability'] = {
    AH: subMarketState,
    OU: subMarketState,
    BTTS: subMarketState,
    ML: subMarketState,
  };

  // Data quality score (0-100) based on verified completeness
  let qualityPoints = 0;
  if (country !== 'Unknown') qualityPoints += 15;
  if (countryCode) qualityPoints += 10;
  if (seasonsAvailable >= 5) qualityPoints += 25;
  else if (seasonsAvailable >= 3) qualityPoints += 15;
  else if (seasonsAvailable >= 1) qualityPoints += 5;
  if (cov?.fixtures?.statistics_fixtures) qualityPoints += 20;
  if (cov?.standings) qualityPoints += 15;
  if (cov?.odds) qualityPoints += 15;
  const dataQualityScore = Math.min(100, qualityPoints);

  // Dynamic Tiering
  let tier: LeagueTier = 'LIMITED_DATA';
  if (isCup) {
    tier = 'UNSUPPORTED';
  } else if (seasonsAvailable >= 7 && oddsAvailability === 'PARTIAL' && coverageStatus === 'FULL') {
    tier = 'CORE';
  } else if (seasonsAvailable >= 5 && oddsAvailability === 'PARTIAL') {
    tier = 'HIGH_VALUE';
  } else if (seasonsAvailable >= 3 && coverageStatus !== 'MINIMAL') {
    tier = 'RESEARCH';
  } else if (oddsAvailability === 'PARTIAL') {
    tier = 'LOW_LIQUIDITY';
  } else {
    tier = 'LIMITED_DATA';
  }

  // Priority formula (0-100):
  // 30% Market Data + 20% Historical Depth + 15% Sample Size Proxy + 15% Odds Coverage + 10% Quality + 10% Predictability (0 for now)
  const marketDataScore = oddsAvailability === 'PARTIAL' ? 80 : 20;
  const depthScore =
    historicalDepth === '7_PLUS' ? 100 :
    historicalDepth === '5_PLUS' ? 80 :
    historicalDepth === '3_4_SEASONS' ? 50 : 20;
  const sampleProxyScore = Math.min(100, seasonsAvailable * 12);
  const oddsCovScore = oddsAvailability === 'PARTIAL' ? 90 : 10;
  const qualityScore = dataQualityScore;
  const predictabilityScore = 0; // Hook initialized to 0; populated in Checkpoint Predictability Engine

  const priorityScore = Math.round(
    0.30 * marketDataScore +
    0.20 * depthScore +
    0.15 * sampleProxyScore +
    0.15 * oddsCovScore +
    0.10 * qualityScore +
    0.10 * predictabilityScore
  );

  const status: GlobalLeague['status'] =
    currentSeasonObj?.current || (currentSeason >= new Date().getFullYear() - 1)
      ? 'ACTIVE'
      : 'INACTIVE';

  return {
    league_id: leagueId,
    name: leagueName,
    league_name: leagueName,
    country,
    country_code: countryCode,
    type,
    season: currentSeason,
    seasons_available: seasonsAvailable,
    all_seasons: allSeasons,
    coverage_status: coverageStatus,
    historical_depth: historicalDepth,
    fixture_count: 'UNKNOWN', // Populated upon fixture ingestion
    odds_availability: oddsAvailability,
    market_availability: marketAvailability,
    predictability_hooks: {
      AH: null,
      OU: null,
      BTTS: null,
      ML: null,
    },
    data_quality_score: dataQualityScore,
    priority_score: priorityScore,
    tier,
    status,
    provider: 'apifootball',
    provider_status: status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED',
    logo: raw.league.logo,
    ingestion_status: isCup ? 'UNAVAILABLE' : 'DISCOVERED',
    last_ingested: null,
    market_readiness: {
      RESULT_READY: false,
      AH_READY: false,
      OU_READY: false,
      BTTS_READY: false,
      ML_READY: false,
    },
  };
}

/**
 * Builds a machine-readable coverage matrix representation for monitoring and research.
 */
export function buildCoverageMatrix(leagues: GlobalLeague[]): LeagueCoverageMatrixItem[] {
  return leagues.map((l) => ({
    league: l.name,
    country: l.country,
    league_id: l.league_id,
    seasons_available: l.seasons_available,
    historical_depth: l.historical_depth,
    fixture_coverage: l.coverage_status,
    AH_coverage: l.market_availability.AH,
    OU_coverage: l.market_availability.OU,
    BTTS_coverage: l.market_availability.BTTS,
    ML_coverage: l.market_availability.ML,
    odds_coverage: l.odds_availability,
    data_quality: l.data_quality_score,
    priority: l.priority_score,
    tier: l.tier,
    status: l.status,
    fixture_count: l.fixture_count,
    ingestion_status: l.ingestion_status,
    last_ingested: l.last_ingested,
    market_readiness: l.market_readiness,
  }));
}

// ─── Live Ingestion & Sync ───────────────────────────────────────────────────

// In-memory discovery cache with 24-hour TTL to respect request economics
let cachedDiscovery: {
  leagues: GlobalLeague[];
  matrix: LeagueCoverageMatrixItem[];
  timestamp: number;
} | null = null;

const DISCOVERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function discoverGlobalLeagues(options: { forceRefresh?: boolean } = {}): Promise<{
  leagues: GlobalLeague[];
  matrix: LeagueCoverageMatrixItem[];
  total: number;
  countries: string[];
  requestsUsed: number;
}> {
  const now = Date.now();
  if (
    !options.forceRefresh &&
    cachedDiscovery &&
    now - cachedDiscovery.timestamp < DISCOVERY_CACHE_TTL_MS
  ) {
    const countries = Array.from(new Set(cachedDiscovery.leagues.map((l) => l.country)));
    return {
      leagues: cachedDiscovery.leagues,
      matrix: cachedDiscovery.matrix,
      total: cachedDiscovery.leagues.length,
      countries,
      requestsUsed: 0,
    };
  }

  // Canonical quota reservation through quotaManager
  const receipt = await acquire('apifootball', 'leagues', 50);
  if (!receipt.ok) {
    throw new Error(`[LeagueRegistry] Quota reservation failed: ${receipt.reason}`);
  }

  const envelope = await apiFootballClient.getLeagues();
  await logCall('apifootball', 'leagues', 0, 200, { count: envelope.response.length });

  const classified = envelope.response.map(classifyLeague);
  const matrix = buildCoverageMatrix(classified);

  cachedDiscovery = {
    leagues: classified,
    matrix,
    timestamp: now,
  };

  const countries = Array.from(new Set(classified.map((l) => l.country)));

  return {
    leagues: classified,
    matrix,
    total: classified.length,
    countries,
    requestsUsed: 1,
  };
}

// ─── Existing Database Synchronization & Legacy API ──────────────────────────

export async function syncLeaguesFromProvider(): Promise<{
  registered: number;
  total: number;
  discovered: GlobalLeague[];
}> {
  try {
    const discovery = await discoverGlobalLeagues();
    const leaguesToSync = discovery.leagues.filter((l) => l.type === 'league');

    let registered = 0;
    for (const league of leaguesToSync) {
      const { data: existing } = await supabase
        .from('league_efficiency')
        .select('id')
        .eq('league_id', league.league_id)
        .maybeSingle();

      if (existing) continue;

      const priorityWeight = league.priority_score / 100;
      await supabase.from('league_efficiency').insert({
        league_id: league.league_id,
        league_name: league.name,
        raw_efficiency: priorityWeight > 0.6 ? 0.01 : 0.001,
        adaptive_priority: priorityWeight,
        season_status: league.status.toLowerCase(),
        last_active_date: null,
      });

      registered += 1;
    }

    return {
      registered,
      total: discovery.total,
      discovered: discovery.leagues,
    };
  } catch (err: any) {
    console.error(`[LeagueRegistry] Sync failed: ${err.message}`);
    return { registered: 0, total: 0, discovered: [] };
  }
}

export async function getActiveLeagues(limit?: number): Promise<LeaguePriority[]> {
  const { data } = await supabase
    .from('league_efficiency')
    .select('*')
    .order('adaptive_priority', { ascending: false });

  if (!data || data.length === 0) {
    return [];
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const season = now.getMonth() >= 7 ? currentYear : currentYear - 1;

  let active: LeaguePriority[] = data.map((r: any) => ({
    apiFootballId: r.league_id,
    name: r.league_name,
    country: '',
    tier: Math.max(1, Math.min(6, Math.round(6 - (parseFloat(r.adaptive_priority ?? '0') * 5)))),
    season,
    varSeason: r.historical_start_season ?? 2020,
  }));

  if (limit && limit > 0) active = active.slice(0, limit);
  return active;
}

export async function getLeagueCount(): Promise<number> {
  const { count } = await supabase
    .from('league_efficiency')
    .select('id', { count: 'exact', head: true });
  return count ?? 0;
}
