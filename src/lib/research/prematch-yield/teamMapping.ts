/**
 * EPL TEAM ENTITY MAPPING & CANONICAL FIXTURE RESOLVER
 * Location: src/lib/research/prematch-yield/teamMapping.ts
 *
 * Implements deterministic team name normalization and fixture join logic
 * between FootyStats provider records and Canonical Gold (football-data.co.uk) records.
 */

export const EPL_TEAM_ALIAS_MAP: Record<string, string> = {
  // FootyStats raw names -> Canonical Short Name
  'afc bournemouth': 'bournemouth',
  'arsenal': 'arsenal',
  'aston villa': 'aston villa',
  'brentford': 'brentford',
  'brighton & hove albion': 'brighton',
  'brighton and hove albion': 'brighton',
  'chelsea': 'chelsea',
  'crystal palace': 'crystal palace',
  'everton': 'everton',
  'fulham': 'fulham',
  'ipswich town': 'ipswich',
  'leicester city': 'leicester',
  'liverpool': 'liverpool',
  'manchester city': 'man city',
  'manchester united': 'man united',
  'newcastle united': 'newcastle',
  'nottingham forest': "nott'm forest",
  'southampton': 'southampton',
  'tottenham hotspur': 'tottenham',
  'west ham united': 'west ham',
  'wolverhampton wanderers': 'wolves',

  // Additional historical EPL clubs for robust multi-season coverage
  'burnley': 'burnley',
  'luton town': 'luton',
  'sheffield united': 'sheffield united',
  'leeds united': 'leeds',
  'watford': 'watford',
  'norwich city': 'norwich',
  'west bromwich albion': 'west brom',
  'west brom': 'west brom',
  'stoke city': 'stoke',
  'swansea city': 'swansea',
  'huddersfield town': 'huddersfield',
  'cardiff city': 'cardiff',
  'hull city': 'hull',
  'middlesbrough': 'middlesbrough',
  'sunderland': 'sunderland',
};

/**
 * Normalizes raw team names by stripping punctuation, extra whitespace,
 * lowercasing, and applying the explicit alias dictionary.
 */
export function normalizeTeamName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[.\-–—]/g, ' ')
    .replace(/\s+/g, ' ');

  return EPL_TEAM_ALIAS_MAP[cleaned] || cleaned;
}

export interface CanonicalGoldMatch {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  resultVerified: boolean;
}

export interface MatchCandidate {
  id: number;
  home_name: string;
  away_name: string;
  date_unix: number;
  status: string;
}

export interface JoinResult {
  canonicalEplFixtureCount: number;
  footystatsFixtureCount: number;
  successfulJoinCount: number;
  joinRatePct: number;
  unmatchedFootyStats: Array<{
    id: number;
    home_name: string;
    away_name: string;
    date: string;
    candidatesFound: number;
  }>;
  unmatchedGold: string[];
  ambiguousMatches: Array<{
    footyId: number;
    home: string;
    away: string;
    matchingCanonicalIds: string[];
  }>;
  matchingMethodology: string;
  pairs: Array<{
    footyId: number;
    canonicalId: string;
    matchDate: string;
    home: string;
    away: string;
    dateDiffDays: number;
  }>;
}

/**
 * Deterministically joins FootyStats matches with Canonical Gold matches.
 * Methodology:
 * 1. Normalize home and away team names using the EPL alias map.
 * 2. Exact match on (season, normalized home, normalized away) with kickoff date window ± 2 days.
 * 3. Asserts uniqueness (1-to-1 matching); flags any ambiguous candidates.
 */
export function joinFixtures(
  footyMatches: MatchCandidate[],
  goldMatches: CanonicalGoldMatch[],
  seasonLabel: string
): JoinResult {
  const filteredGold = goldMatches.filter(
    (g) => g.leagueId === 'ENG-PL' && g.season === seasonLabel
  );

  const matchedGoldIds = new Set<string>();
  const unmatchedFooty: JoinResult['unmatchedFootyStats'] = [];
  const ambiguousMatches: JoinResult['ambiguousMatches'] = [];
  const pairs: JoinResult['pairs'] = [];

  for (const f of footyMatches) {
    const fHomeNorm = normalizeTeamName(f.home_name);
    const fAwayNorm = normalizeTeamName(f.away_name);
    const fDateStr = new Date(f.date_unix * 1000).toISOString().split('T')[0];
    const fTime = f.date_unix * 1000;

    // Search matching gold fixtures
    const candidates = filteredGold.filter((g) => {
      const gHomeNorm = normalizeTeamName(g.homeTeam);
      const gAwayNorm = normalizeTeamName(g.awayTeam);
      if (gHomeNorm !== fHomeNorm || gAwayNorm !== fAwayNorm) {
        return false;
      }
      const gTime = new Date(g.matchDate).getTime();
      const diffDays = Math.abs(fTime - gTime) / (1000 * 60 * 60 * 24);
      return diffDays <= 2.0; // Allow fixture rescheduling within 2 days
    });

    if (candidates.length === 1) {
      const g = candidates[0];
      matchedGoldIds.add(g.canonicalId);
      const gTime = new Date(g.matchDate).getTime();
      const dateDiffDays = Math.round((Math.abs(fTime - gTime) / (1000 * 60 * 60 * 24)) * 100) / 100;

      pairs.push({
        footyId: f.id,
        canonicalId: g.canonicalId,
        matchDate: g.matchDate,
        home: f.home_name,
        away: f.away_name,
        dateDiffDays,
      });
    } else if (candidates.length > 1) {
      ambiguousMatches.push({
        footyId: f.id,
        home: f.home_name,
        away: f.away_name,
        matchingCanonicalIds: candidates.map((c) => c.canonicalId),
      });
    } else {
      unmatchedFooty.push({
        id: f.id,
        home_name: f.home_name,
        away_name: f.away_name,
        date: fDateStr,
        candidatesFound: 0,
      });
    }
  }

  const unmatchedGold = filteredGold
    .filter((g) => !matchedGoldIds.has(g.canonicalId))
    .map((g) => g.canonicalId);

  const successfulJoinCount = pairs.length;
  const joinRatePct =
    footyMatches.length > 0
      ? Math.round((successfulJoinCount / footyMatches.length) * 10000) / 100
      : 0;

  return {
    canonicalEplFixtureCount: filteredGold.length,
    footystatsFixtureCount: footyMatches.length,
    successfulJoinCount,
    joinRatePct,
    unmatchedFootyStats: unmatchedFooty,
    unmatchedGold,
    ambiguousMatches,
    matchingMethodology:
      'Exact join on (season, normalizeTeamName(home), normalizeTeamName(away)) with kickoff date diff <= 2.0 days',
    pairs,
  };
}

