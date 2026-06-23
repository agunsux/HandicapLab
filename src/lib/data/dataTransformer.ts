import { MatchInput } from '../../services/probability.engine';

export interface TransformedMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  leagueId: number;
  season: number;
  input: MatchInput & {
    pressure_intensity: number;
    htScore: string;
  };
  outcome: {
    htHomeGoals: number;
    htAwayGoals: number;
    ftHomeGoals: number;
    ftAwayGoals: number;
    shHomeGoals: number;
    shAwayGoals: number;
    shTotalGoals: number;
    secondHalfUnder: boolean; // true if secondHalfGoals <= 1
  };
}

/**
 * Extracts a statistic value by type from the API-Football statistics array.
 */
export function getStatValue(stats: any[] | undefined, type: string): number {
  if (!stats || !Array.isArray(stats)) return 0;
  const stat = stats.find(s => s.type === type);
  if (!stat || stat.value === null || stat.value === undefined) return 0;
  
  if (typeof stat.value === 'string') {
    // Handle possession percentage strings like "55%"
    return parseFloat(stat.value.replace('%', ''));
  }
  return Number(stat.value);
}

/**
 * Transforms raw API-Football fixture and statistics into our internal format.
 */
export function transformFixtureData(
  fixturePayload: any,
  homeStats: any[] | undefined,
  awayStats: any[] | undefined,
  leagueAvgShots = 25.0,
  leagueAvgFouls = 22.0
): TransformedMatch {
  const homeGoals = fixturePayload.goals.home ?? 0;
  const awayGoals = fixturePayload.goals.away ?? 0;
  const htHome = fixturePayload.score.halftime.home ?? 0;
  const htAway = fixturePayload.score.halftime.away ?? 0;

  const shHomeGoals = homeGoals - htHome;
  const shAwayGoals = awayGoals - htAway;
  const shTotalGoals = shHomeGoals + shAwayGoals;

  // Extract Stats
  const homeShots = getStatValue(homeStats, 'Total Shots');
  const awayShots = getStatValue(awayStats, 'Total Shots');
  const totalShots = homeShots + awayShots;

  const homeFouls = getStatValue(homeStats, 'Fouls');
  const awayFouls = getStatValue(awayStats, 'Fouls');
  const totalFouls = homeFouls + awayFouls;

  // Check for Dangerous Attacks statistic, with fallback
  let homeDangerousAttacks = getStatValue(homeStats, 'Dangerous Attacks');
  let awayDangerousAttacks = getStatValue(awayStats, 'Dangerous Attacks');
  
  // Fallback if Dangerous Attacks is missing from both teams
  if (homeDangerousAttacks === 0 && awayDangerousAttacks === 0) {
    const homeShotsOnTarget = getStatValue(homeStats, 'Shots on Goal');
    const awayShotsOnTarget = getStatValue(awayStats, 'Shots on Goal');
    homeDangerousAttacks = homeShots + homeFouls + homeShotsOnTarget;
    awayDangerousAttacks = awayShots + awayFouls + awayShotsOnTarget;
  }
  const totalDangerousAttacks = homeDangerousAttacks + awayDangerousAttacks;

  // Normalizations
  const tempo = totalShots / leagueAvgShots;
  const pressure = totalFouls / leagueAvgFouls;
  const pressureIntensity = totalDangerousAttacks;

  // defShape (goalsAgainst: lower is better)
  const defShapeHome = awayGoals; // Goals conceded by home team
  const defShapeAway = homeGoals; // Goals conceded by away team

  const htScore = `${htHome}-${htAway}`;

  return {
    matchId: String(fixturePayload.fixture.id),
    homeTeam: fixturePayload.teams.home.name,
    awayTeam: fixturePayload.teams.away.name,
    date: fixturePayload.fixture.date,
    leagueId: fixturePayload.league.id,
    season: fixturePayload.league.season,
    input: {
      odds_home: 2.0, // Default placeholders for match outcome prediction
      odds_draw: 3.2,
      odds_away: 3.5,
      ah_line: 0,
      ou_line: 2.5,
      btts_odds: 1.8,
      xg_home: 1.5,
      xg_away: 1.2,
      shots_home: homeShots,
      shots_away: awayShots,
      shots_on_target_home: getStatValue(homeStats, 'Shots on Goal'),
      shots_on_target_away: getStatValue(awayStats, 'Shots on Goal'),
      form_home: 3,
      form_away: 3,
      domain_tempo: tempo,
      domain_pressure: pressure,
      pressure_intensity: pressureIntensity,
      domain_defensiveShapeHome: defShapeHome,
      domain_defensiveShapeAway: defShapeAway,
      ht_home_goals: htHome,
      ht_away_goals: htAway,
      htScore
    },
    outcome: {
      htHomeGoals: htHome,
      htAwayGoals: htAway,
      ftHomeGoals: homeGoals,
      ftAwayGoals: awayGoals,
      shHomeGoals,
      shAwayGoals,
      shTotalGoals,
      secondHalfUnder: shTotalGoals <= 1
    }
  };
}
