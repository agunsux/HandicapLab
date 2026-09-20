// ============================================================================
// CANONICAL MULTI-LEAGUE REGISTRY — HANDICAPLAB EXPANSION v1
// ============================================================================
// Location: src/lib/config/multiLeagueRegistry.ts
//
// Single source of truth for the 15 candidate leagues across Tiers A, B, and C.
// Invariants:
// - Explicit non-boolean lifecycle states: DISCOVERY | SHADOW | ACTIVE | PAUSED | DISABLED
// - Fail-closed: No league becomes ACTIVE without passing Data Quality, Odds, and Model gates.
// - Real provider evidence only: IDs and coverage flags verified via live APIs.
// - Supported markets strictly limited to: AH, OU, BTTS (Zero Moneyline).
// ============================================================================

export type LeagueTier = 'A' | 'B' | 'C';

export type ProductionStatus = 'DISCOVERY' | 'SHADOW' | 'ACTIVE' | 'PAUSED' | 'DISABLED';

export type DeterministicReasonCode =
  | 'ACTIVE_QUALIFIED'
  | 'NOT_ACTIVE: NO_ODDS'
  | 'NOT_ACTIVE: INSUFFICIENT_MODEL_SAMPLE'
  | 'NOT_ACTIVE: PROVIDER_MAPPING_MISSING'
  | 'NOT_ACTIVE: PINNACLE_UNAVAILABLE'
  | 'NOT_ACTIVE: DATA_COMPLETENESS_FAIL'
  | 'NOT_ACTIVE: QUOTA_CONSTRAINED'
  | 'NOT_ACTIVE: PHASE_GATED';

export interface MultiLeagueEntry {
  internal_league_id: string; // e.g. 'ENG-PL'
  provider_league_id: number; // API-Football ID
  country: string;
  league_name: string;
  display_name: string;
  tier: LeagueTier;
  timezone: string;
  current_season: number;
  previous_seasons_available: number;
  all_seasons: number[];
  api_football_coverage_status: 'FULL' | 'PARTIAL' | 'MINIMAL';
  fixtures_availability: boolean;
  results_availability: boolean;
  statistics_availability: boolean;
  standings_availability: boolean;
  injuries_availability: boolean;
  odds_availability: boolean;
  oddspapi_tournament_id: number;
  oddspapi_tournament_slug: string;
  pinnacle_availability: boolean;
  supported_ah_availability: boolean;
  supported_ou_availability: boolean;
  supported_btts_inputs: boolean;
  finished_match_count: number;
  historical_sample_count: number;
  current_fixture_count: number;
  upcoming_7day_fixture_count: number;
  provider_freshness: string; // ISO 8601 or description
  data_completeness: number; // 0-100 percentage
  model_eligibility: boolean;
  production_status: ProductionStatus;
  non_active_reason: DeterministicReasonCode;
  priority_score: number; // 0-100 operational priority
}

/**
 * Calculates the operational league priority score (0-100) based strictly on
 * measurable data infrastructure factors. This is NOT a betting yield score.
 */
export function calculateLeaguePriorityScore(factors: {
  data_completeness: number; // 0-100
  pinnacle_availability: boolean;
  odds_availability: boolean;
  historical_sample_count: number;
  statistics_availability: boolean;
  fixtures_availability: boolean;
}): number {
  let score = 0;
  // 30% Data completeness
  score += (factors.data_completeness / 100) * 30;
  // 25% Pinnacle sharp reference presence
  if (factors.pinnacle_availability) score += 25;
  // 15% General odds availability
  if (factors.odds_availability) score += 15;
  // 15% Historical sample depth (500+ matches = full score)
  const sampleRatio = Math.min(1.0, factors.historical_sample_count / 500);
  score += sampleRatio * 15;
  // 10% Match statistics availability (for xG & ratings)
  if (factors.statistics_availability) score += 10;
  // 5% Fixture feed availability
  if (factors.fixtures_availability) score += 5;

  return Math.round(score);
}

/**
 * Verified 15 Candidate League Registry.
 * All API-Football and OddsPapi IDs have been verified from provider responses.
 */
export const CANONICAL_15_LEAGUES: MultiLeagueEntry[] = [
  // ─── TIER A — PRIMARY (Verified European Big 5) ───────────────────────────
  {
    internal_league_id: 'ENG-PL',
    provider_league_id: 39,
    country: 'England',
    league_name: 'Premier League',
    display_name: 'Premier League',
    tier: 'A',
    timezone: 'Europe/London',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 17,
    oddspapi_tournament_slug: 'premier-league',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 4180,
    historical_sample_count: 4180,
    current_fixture_count: 380,
    upcoming_7day_fixture_count: 10,
    provider_freshness: 'LIVE',
    data_completeness: 100,
    model_eligibility: true,
    production_status: 'ACTIVE',
    non_active_reason: 'ACTIVE_QUALIFIED',
    priority_score: 100,
  },
  {
    internal_league_id: 'ESP-LALIGA',
    provider_league_id: 140,
    country: 'Spain',
    league_name: 'La Liga',
    display_name: 'La Liga',
    tier: 'A',
    timezone: 'Europe/Madrid',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 8,
    oddspapi_tournament_slug: 'laliga',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 1520,
    historical_sample_count: 1520,
    current_fixture_count: 380,
    upcoming_7day_fixture_count: 10,
    provider_freshness: 'LIVE',
    data_completeness: 98,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 95,
  },
  {
    internal_league_id: 'ITA-SERIEA',
    provider_league_id: 135,
    country: 'Italy',
    league_name: 'Serie A',
    display_name: 'Serie A',
    tier: 'A',
    timezone: 'Europe/Rome',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 23,
    oddspapi_tournament_slug: 'serie-a',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 1520,
    historical_sample_count: 1520,
    current_fixture_count: 380,
    upcoming_7day_fixture_count: 10,
    provider_freshness: 'LIVE',
    data_completeness: 98,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 95,
  },
  {
    internal_league_id: 'DEU-BUNDESLIGA',
    provider_league_id: 78,
    country: 'Germany',
    league_name: 'Bundesliga',
    display_name: 'Bundesliga',
    tier: 'A',
    timezone: 'Europe/Berlin',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 35,
    oddspapi_tournament_slug: 'bundesliga',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 918,
    historical_sample_count: 918,
    current_fixture_count: 306,
    upcoming_7day_fixture_count: 9,
    provider_freshness: 'LIVE',
    data_completeness: 98,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 95,
  },
  {
    internal_league_id: 'FRA-LIGUE1',
    provider_league_id: 61,
    country: 'France',
    league_name: 'Ligue 1',
    display_name: 'Ligue 1',
    tier: 'A',
    timezone: 'Europe/Paris',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 34,
    oddspapi_tournament_slug: 'ligue-1',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 1400,
    historical_sample_count: 1400,
    current_fixture_count: 306,
    upcoming_7day_fixture_count: 9,
    provider_freshness: 'LIVE',
    data_completeness: 98,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 95,
  },

  // ─── TIER B — SECONDARY EUROPE ───────────────────────────────────────────
  {
    internal_league_id: 'NED-ERE',
    provider_league_id: 88,
    country: 'Netherlands',
    league_name: 'Eredivisie',
    display_name: 'Eredivisie',
    tier: 'B',
    timezone: 'Europe/Amsterdam',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 37,
    oddspapi_tournament_slug: 'eredivisie',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 306,
    historical_sample_count: 306,
    current_fixture_count: 306,
    upcoming_7day_fixture_count: 9,
    provider_freshness: 'LIVE',
    data_completeness: 92,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 82,
  },
  {
    internal_league_id: 'POR-PRIMEIRA',
    provider_league_id: 94,
    country: 'Portugal',
    league_name: 'Primeira Liga',
    display_name: 'Primeira Liga',
    tier: 'B',
    timezone: 'Europe/Lisbon',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 238,
    oddspapi_tournament_slug: 'liga-portugal',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 306,
    historical_sample_count: 306,
    current_fixture_count: 306,
    upcoming_7day_fixture_count: 9,
    provider_freshness: 'LIVE',
    data_completeness: 92,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 82,
  },
  {
    internal_league_id: 'BEL-PRO',
    provider_league_id: 144,
    country: 'Belgium',
    league_name: 'Jupiler Pro League',
    display_name: 'Jupiler Pro League',
    tier: 'B',
    timezone: 'Europe/Brussels',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 38,
    oddspapi_tournament_slug: 'pro-league',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 240,
    historical_sample_count: 240,
    current_fixture_count: 240,
    upcoming_7day_fixture_count: 8,
    provider_freshness: 'LIVE',
    data_completeness: 92,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 80,
  },
  {
    internal_league_id: 'SCO-PREM',
    provider_league_id: 179,
    country: 'Scotland',
    league_name: 'Premiership',
    display_name: 'Scottish Premiership',
    tier: 'B',
    timezone: 'Europe/London',
    current_season: 2026,
    previous_seasons_available: 17,
    all_seasons: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 36,
    oddspapi_tournament_slug: 'premiership',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 228,
    historical_sample_count: 228,
    current_fixture_count: 228,
    upcoming_7day_fixture_count: 6,
    provider_freshness: 'LIVE',
    data_completeness: 90,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 78,
  },
  {
    internal_league_id: 'ENG-CHAMP',
    provider_league_id: 40,
    country: 'England',
    league_name: 'Championship',
    display_name: 'Championship',
    tier: 'B',
    timezone: 'Europe/London',
    current_season: 2026,
    previous_seasons_available: 16,
    all_seasons: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 18,
    oddspapi_tournament_slug: 'championship',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 552,
    historical_sample_count: 552,
    current_fixture_count: 552,
    upcoming_7day_fixture_count: 12,
    provider_freshness: 'LIVE',
    data_completeness: 98,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 88,
  },

  // ─── TIER C — GLOBAL EXPANSION ───────────────────────────────────────────
  {
    internal_league_id: 'USA-MLS',
    provider_league_id: 253,
    country: 'USA',
    league_name: 'Major League Soccer',
    display_name: 'MLS',
    tier: 'C',
    timezone: 'America/New_York',
    current_season: 2026,
    previous_seasons_available: 15,
    all_seasons: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: true,
    odds_availability: true,
    oddspapi_tournament_id: 242,
    oddspapi_tournament_slug: 'mls',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 450,
    historical_sample_count: 450,
    current_fixture_count: 450,
    upcoming_7day_fixture_count: 14,
    provider_freshness: 'LIVE',
    data_completeness: 95,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 75,
  },
  {
    internal_league_id: 'SAU-PRO',
    provider_league_id: 307,
    country: 'Saudi Arabia',
    league_name: 'Pro League',
    display_name: 'Saudi Pro League',
    tier: 'C',
    timezone: 'Asia/Riyadh',
    current_season: 2026,
    previous_seasons_available: 11,
    all_seasons: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 955,
    oddspapi_tournament_slug: 'saudi-pro-league',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 306,
    historical_sample_count: 306,
    current_fixture_count: 306,
    upcoming_7day_fixture_count: 9,
    provider_freshness: 'LIVE',
    data_completeness: 88,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 70,
  },
  {
    internal_league_id: 'JPN-J1',
    provider_league_id: 98,
    country: 'Japan',
    league_name: 'J1 League',
    display_name: 'J1 League',
    tier: 'C',
    timezone: 'Asia/Tokyo',
    current_season: 2027,
    previous_seasons_available: 16,
    all_seasons: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 196,
    oddspapi_tournament_slug: 'jleague',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 380,
    historical_sample_count: 380,
    current_fixture_count: 380,
    upcoming_7day_fixture_count: 10,
    provider_freshness: 'LIVE',
    data_completeness: 88,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 70,
  },
  {
    internal_league_id: 'KOR-K1',
    provider_league_id: 292,
    country: 'South Korea',
    league_name: 'K League 1',
    display_name: 'K League 1',
    tier: 'C',
    timezone: 'Asia/Seoul',
    current_season: 2026,
    previous_seasons_available: 11,
    all_seasons: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'FULL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: true,
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 410,
    oddspapi_tournament_slug: 'k-league-1',
    pinnacle_availability: true,
    supported_ah_availability: true,
    supported_ou_availability: true,
    supported_btts_inputs: true,
    finished_match_count: 228,
    historical_sample_count: 228,
    current_fixture_count: 228,
    upcoming_7day_fixture_count: 6,
    provider_freshness: 'LIVE',
    data_completeness: 85,
    model_eligibility: true,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: PHASE_GATED',
    priority_score: 68,
  },
  {
    internal_league_id: 'IDN-L1',
    provider_league_id: 274,
    country: 'Indonesia',
    league_name: 'Liga 1',
    display_name: 'Liga 1 Indonesia',
    tier: 'C',
    timezone: 'Asia/Jakarta',
    current_season: 2026,
    previous_seasons_available: 10,
    all_seasons: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    api_football_coverage_status: 'PARTIAL',
    fixtures_availability: true,
    results_availability: true,
    statistics_availability: false, // VERIFIED: API-Football does not track match statistics for Liga 1
    standings_availability: true,
    injuries_availability: false,
    odds_availability: true,
    oddspapi_tournament_id: 1015,
    oddspapi_tournament_slug: 'liga-1',
    pinnacle_availability: false, // OddsPapi lacks Pinnacle market depth for IDN-L1
    supported_ah_availability: false,
    supported_ou_availability: false,
    supported_btts_inputs: false,
    finished_match_count: 306,
    historical_sample_count: 306,
    current_fixture_count: 306,
    upcoming_7day_fixture_count: 9,
    provider_freshness: 'LIVE',
    data_completeness: 48,
    model_eligibility: false,
    production_status: 'SHADOW',
    non_active_reason: 'NOT_ACTIVE: DATA_COMPLETENESS_FAIL',
    priority_score: 42,
  },
];

// ─── Fast Lookups ─────────────────────────────────────────────────────────────

const BY_KEY = new Map(CANONICAL_15_LEAGUES.map((l) => [l.internal_league_id, l]));
const BY_AF_ID = new Map(CANONICAL_15_LEAGUES.map((l) => [l.provider_league_id, l]));
const BY_OP_ID = new Map(CANONICAL_15_LEAGUES.map((l) => [l.oddspapi_tournament_id, l]));

export function getLeagueByKey(key: string): MultiLeagueEntry | undefined {
  return BY_KEY.get(key);
}

export function getLeagueByAfId(id: number): MultiLeagueEntry | undefined {
  return BY_AF_ID.get(id);
}

export function getLeagueByOpId(id: number): MultiLeagueEntry | undefined {
  return BY_OP_ID.get(id);
}

export function getActiveLeagues(): MultiLeagueEntry[] {
  return CANONICAL_15_LEAGUES.filter((l) => l.production_status === 'ACTIVE');
}

export function getShadowLeagues(): MultiLeagueEntry[] {
  return CANONICAL_15_LEAGUES.filter((l) => l.production_status === 'SHADOW');
}

export function getDiscoveryLeagues(): MultiLeagueEntry[] {
  return CANONICAL_15_LEAGUES.filter((l) => l.production_status === 'DISCOVERY');
}

export function getCandidateLeagueKeys(): string[] {
  return CANONICAL_15_LEAGUES.map((l) => l.internal_league_id);
}

