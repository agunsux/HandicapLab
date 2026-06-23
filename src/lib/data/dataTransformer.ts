import { MatchInput } from '../../services/probability.engine';

export interface PreMatchFeatures {
  homeTeamStrength: number;  // goals scored / goals conceded
  awayTeamStrength: number;
  homeForm: number;          // points per game in last 5 matches (W=3, D=1, L=0)
  awayForm: number;          // points per game in last 5 matches
  h2hHomeWinRate: number;    // % home wins in direct H2H matches
  h2hAwayWinRate: number;    // % away wins in direct H2H matches
  h2hDrawRate: number;       // % draws in direct H2H matches
}

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
  preMatchFeatures?: PreMatchFeatures;
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

export function calculatePreMatchFeatures(
  homeTeam: string,
  awayTeam: string,
  matchDateStr: string,
  historicalMatches: TransformedMatch[]
): PreMatchFeatures {
  const matchDate = new Date(matchDateStr);

  // Filter historical matches to only those played before the target match date
  const pastMatches = historicalMatches.filter(m => {
    const mDate = new Date(m.date);
    return mDate < matchDate;
  });

  // 1. Calculate home team stats
  const homePast = pastMatches.filter(m => m.homeTeam === homeTeam || m.awayTeam === homeTeam);
  let homeGoalsScored = 0;
  let homeGoalsConceded = 0;
  for (const m of homePast) {
    if (m.homeTeam === homeTeam) {
      homeGoalsScored += m.outcome.ftHomeGoals;
      homeGoalsConceded += m.outcome.ftAwayGoals;
    } else {
      homeGoalsScored += m.outcome.ftAwayGoals;
      homeGoalsConceded += m.outcome.ftHomeGoals;
    }
  }
  const homeTeamStrength = homeGoalsConceded > 0 ? homeGoalsScored / homeGoalsConceded : (homeGoalsScored > 0 ? 3.0 : 1.0);

  // 2. Calculate away team stats
  const awayPast = pastMatches.filter(m => m.homeTeam === awayTeam || m.awayTeam === awayTeam);
  let awayGoalsScored = 0;
  let awayGoalsConceded = 0;
  for (const m of awayPast) {
    if (m.homeTeam === awayTeam) {
      awayGoalsScored += m.outcome.ftHomeGoals;
      awayGoalsConceded += m.outcome.ftAwayGoals;
    } else {
      awayGoalsScored += m.outcome.ftAwayGoals;
      awayGoalsConceded += m.outcome.ftHomeGoals;
    }
  }
  const awayTeamStrength = awayGoalsConceded > 0 ? awayGoalsScored / awayGoalsConceded : (awayGoalsScored > 0 ? 3.0 : 1.0);

  // 3. Calculate Home Form (last 5 matches)
  const homeLast5 = homePast
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  let homeFormPoints = 0;
  for (const m of homeLast5) {
    if (m.homeTeam === homeTeam) {
      if (m.outcome.ftHomeGoals > m.outcome.ftAwayGoals) homeFormPoints += 3;
      else if (m.outcome.ftHomeGoals === m.outcome.ftAwayGoals) homeFormPoints += 1;
    } else {
      if (m.outcome.ftAwayGoals > m.outcome.ftHomeGoals) homeFormPoints += 3;
      else if (m.outcome.ftAwayGoals === m.outcome.ftHomeGoals) homeFormPoints += 1;
    }
  }
  const homeForm = homeLast5.length > 0 ? homeFormPoints / homeLast5.length : 1.5; // fallback to 1.5 pts/game

  // 4. Calculate Away Form (last 5 matches)
  const awayLast5 = awayPast
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  let awayFormPoints = 0;
  for (const m of awayLast5) {
    if (m.homeTeam === awayTeam) {
      if (m.outcome.ftHomeGoals > m.outcome.ftAwayGoals) awayFormPoints += 3;
      else if (m.outcome.ftHomeGoals === m.outcome.ftAwayGoals) awayFormPoints += 1;
    } else {
      if (m.outcome.ftAwayGoals > m.outcome.ftHomeGoals) awayFormPoints += 3;
      else if (m.outcome.ftAwayGoals === m.outcome.ftHomeGoals) awayFormPoints += 1;
    }
  }
  const awayForm = awayLast5.length > 0 ? awayFormPoints / awayLast5.length : 1.5;

  // 5. Calculate H2H stats
  const h2hMatches = pastMatches.filter(
    m => (m.homeTeam === homeTeam && m.awayTeam === awayTeam) || (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
  );
  let h2hHomeWins = 0;
  let h2hAwayWins = 0;
  let h2hDraws = 0;
  for (const m of h2hMatches) {
    if (m.homeTeam === homeTeam) {
      if (m.outcome.ftHomeGoals > m.outcome.ftAwayGoals) h2hHomeWins++;
      else if (m.outcome.ftHomeGoals < m.outcome.ftAwayGoals) h2hAwayWins++;
      else h2hDraws++;
    } else {
      if (m.outcome.ftAwayGoals > m.outcome.ftHomeGoals) h2hHomeWins++;
      else if (m.outcome.ftAwayGoals < m.outcome.ftHomeGoals) h2hAwayWins++;
      else h2hDraws++;
    }
  }
  const h2hCount = h2hMatches.length;
  const h2hHomeWinRate = h2hCount > 0 ? h2hHomeWins / h2hCount : 0.33;
  const h2hAwayWinRate = h2hCount > 0 ? h2hAwayWins / h2hCount : 0.33;
  const h2hDrawRate = h2hCount > 0 ? h2hDraws / h2hCount : 0.33;

  return {
    homeTeamStrength,
    awayTeamStrength,
    homeForm,
    awayForm,
    h2hHomeWinRate,
    h2hAwayWinRate,
    h2hDrawRate
  };
}
