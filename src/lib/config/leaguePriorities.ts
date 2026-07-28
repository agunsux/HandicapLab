// EPIC 53 Stage A — League Priority Tiers
// Controls which leagues get quota first when resources are constrained.
// Config, not database — changes require deploy, which is fine for <100 leagues.
// Priority 1 = always process (top 5 Europe), 2 = Europe tier 2, 3 = Americas,
// 4 = Asia, 5 = Middle East, 6 = other supported

export interface LeaguePriority {
  apiFootballId: number;
  name: string;
  country: string;
  tier: number; // 1-6
  season: number;
  varSeason: number; // first season with VAR
}

// Current season
const SEASON = 2025;

export const LEAGUE_PRIORITIES: LeaguePriority[] = [
  // Tier 1 — Top 5 Europe
  { apiFootballId: 39,  name: 'Premier League',       country: 'England',     tier: 1, season: SEASON, varSeason: 2019 },
  { apiFootballId: 140, name: 'La Liga',               country: 'Spain',       tier: 1, season: SEASON, varSeason: 2018 },
  { apiFootballId: 78,  name: 'Bundesliga',             country: 'Germany',    tier: 1, season: SEASON, varSeason: 2017 },
  { apiFootballId: 135, name: 'Serie A',               country: 'Italy',       tier: 1, season: SEASON, varSeason: 2017 },
  { apiFootballId: 61,  name: 'Ligue 1',               country: 'France',      tier: 1, season: SEASON, varSeason: 2018 },

  // Tier 2 — Europe Tier 2
  { apiFootballId: 94,  name: 'Primeira Liga',          country: 'Portugal',   tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 88,  name: 'Eredivisie',             country: 'Netherlands', tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 144, name: 'Jupiler Pro League',     country: 'Belgium',    tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 179, name: 'Scottish Premiership',   country: 'Scotland',   tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 203, name: 'Super Lig',              country: 'Turkey',     tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 94,  name: 'Liga Portugal',          country: 'Portugal',   tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 207, name: 'Swiss Super League',     country: 'Switzerland', tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 218, name: 'Championship',           country: 'England',    tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 345, name: 'Czech First League',     country: 'Czech Republic', tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 315, name: 'Austrian Bundesliga',    country: 'Austria',    tier: 2, season: SEASON, varSeason: 2020 },
  { apiFootballId: 212, name: 'Super League Greece',    country: 'Greece',     tier: 2, season: SEASON, varSeason: 2020 },

  // Tier 3 — Americas
  { apiFootballId: 71,  name: 'Serie A Brazil',        country: 'Brazil',      tier: 3, season: SEASON, varSeason: 2021 },
  { apiFootballId: 128, name: 'Liga Profesional',       country: 'Argentina',  tier: 3, season: SEASON, varSeason: 2021 },
  { apiFootballId: 108, name: 'MLS',                    country: 'USA',        tier: 3, season: SEASON, varSeason: 2021 },
  { apiFootballId: 73,  name: 'Liga MX',                country: 'Mexico',     tier: 3, season: SEASON, varSeason: 2021 },
  { apiFootballId: 119, name: 'Primera Division Chile',  country: 'Chile',     tier: 3, season: SEASON, varSeason: 2021 },
  { apiFootballId: 130, name: 'Primera A Colombia',     country: 'Colombia',   tier: 3, season: SEASON, varSeason: 2021 },

  // Tier 4 — Asia
  { apiFootballId: 98,  name: 'J1 League',              country: 'Japan',      tier: 4, season: SEASON, varSeason: 2022 },
  { apiFootballId: 83,  name: 'K League 1',             country: 'South Korea', tier: 4, season: SEASON, varSeason: 2022 },
  { apiFootballId: 167, name: 'Chinese Super League',   country: 'China',      tier: 4, season: SEASON, varSeason: 2022 },
  { apiFootballId: 166, name: 'A-League',               country: 'Australia',  tier: 4, season: SEASON, varSeason: 2022 },
  { apiFootballId: 169, name: 'Saudi Pro League',       country: 'Saudi Arabia', tier: 4, season: SEASON, varSeason: 2022 },

  // Tier 5 — Middle East / Africa
  { apiFootballId: 225, name: 'UAE Pro League',         country: 'UAE',        tier: 5, season: SEASON, varSeason: 2022 },
  { apiFootballId: 233, name: 'Egypt Premier League',   country: 'Egypt',      tier: 5, season: SEASON, varSeason: 2022 },
  { apiFootballId: 239, name: 'Morocco Botola',         country: 'Morocco',    tier: 5, season: SEASON, varSeason: 2022 },

  // Tier 6 — Other supported
  { apiFootballId: 72,  name: 'Ekstraklasa',            country: 'Poland',     tier: 6, season: SEASON, varSeason: 2020 },
  { apiFootballId: 197, name: 'Super League China',     country: 'China',      tier: 6, season: SEASON, varSeason: 2022 },
  { apiFootballId: 262, name: 'Liga 1 Indonesia',       country: 'Indonesia',  tier: 6, season: SEASON, varSeason: 2023 },
];

export function getLeagueById(id: number): LeaguePriority | undefined {
  return LEAGUE_PRIORITIES.find((l) => l.apiFootballId === id);
}

export function getLeaguesByTier(minTier: number, maxTier = 6): LeaguePriority[] {
  return LEAGUE_PRIORITIES.filter((l) => l.tier >= minTier && l.tier <= maxTier);
}
