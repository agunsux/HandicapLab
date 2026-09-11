import type { EdgeMatch, PointInTimeFeatures } from '../../src/lib/research/ah-edge/edgeTypes';

export function zeroFeatures(): PointInTimeFeatures {
  return {
    eloHome: 0,
    eloAway: 0,
    eloDiff: 0,
    homePpg5: 0,
    awayPpg5: 0,
    homeGf5: 0,
    homeGa5: 0,
    awayGf5: 0,
    awayGa5: 0,
    homeRestDays: 0,
    awayRestDays: 0,
    homeSeasonMatches: 0,
    awaySeasonMatches: 0,
    homeSeasonPpg: 0,
    awaySeasonPpg: 0,
    homeSeasonGfPerMatch: 0,
    homeSeasonGaPerMatch: 0,
    awaySeasonGfPerMatch: 0,
    awaySeasonGaPerMatch: 0,
    leagueHomeGoalsPerMatch: 0,
    leagueAwayGoalsPerMatch: 0,
    homeAdvantageGoals: 0,
  };
}

let counter = 0;

export function makeEdgeMatch(overrides: Partial<EdgeMatch> = {}): EdgeMatch {
  counter += 1;
  const homeGoals = overrides.homeGoals ?? 1;
  const awayGoals = overrides.awayGoals ?? 0;
  return {
    canonicalId: `M-${counter}`,
    leagueId: 'ENG-PL',
    season: '2020-2021',
    matchDate: '2021-01-01',
    homeTeam: `Home-${counter}`,
    awayTeam: `Away-${counter}`,
    homeGoals,
    awayGoals,
    ah: { line: -0.5, homeOdds: 1.95, awayOdds: 1.95 },
    ahOpening: null,
    mlClosing: { pHome: 0.45, pDraw: 0.27, pAway: 0.28 },
    mlOpening: null,
    ouClosingOver25: 0.52,
    features: zeroFeatures(),
    ...overrides,
  };
}
