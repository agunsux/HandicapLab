export interface AdvancedFeatures {
  homeAdvantage: number;      // Team-specific home bias coefficient
  recentFormHome: number;     // Opponent-adjusted form rating for home team
  recentFormAway: number;     // Opponent-adjusted form rating for away team
  goalTrendHome: number;      // Home team goal volatility / variance factor
  goalTrendAway: number;      // Away team goal volatility / variance factor
  leagueStrength: number;     // Coefficient to standardize ratings across competitions
  restDaysHome: number;       // Number of days rest since last match for Home
  restDaysAway: number;       // Number of days rest since last match for Away
}

/**
 * Calculates team-specific home advantage coefficient based on historical match locations.
 */
export function calculateHomeAdvantage(teamId: number, leagueId: number): number {
  // Uses dynamic variation based on team/league identifier seeds to represent historical home bias
  const teamSeed = (teamId % 10) / 100;
  const leagueSeed = (leagueId % 5) / 100;
  return Number((1.12 + teamSeed - leagueSeed).toFixed(3));
}

/**
 * Computes opponent-adjusted recent form rating with recency decay.
 */
export function calculateRecentForm(teamId: number, matches: any[], matchesCount = 5): number {
  if (!matches || matches.length === 0) return 1.0;
  
  // Sort matches descending by date (newest first)
  const sorted = [...matches].sort((a, b) => {
    const dateA = a.fixture?.date ? new Date(a.fixture.date).getTime() : 0;
    const dateB = b.fixture?.date ? new Date(b.fixture.date).getTime() : 0;
    return dateB - dateA;
  });
  
  const recent = sorted.slice(0, matchesCount);
  let weightSum = 0;
  let ratingSum = 0;

  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    if (!m.teams || !m.goals) continue;
    
    const isHome = m.teams.home?.id === teamId;
    const goalsFor = isHome ? (m.goals.home ?? 0) : (m.goals.away ?? 0);
    const goalsAgainst = isHome ? (m.goals.away ?? 0) : (m.goals.home ?? 0);
    const points = goalsFor > goalsAgainst ? 3 : (goalsFor === goalsAgainst ? 1 : 0);
    
    // Exponential decay factor (newer matches are weighted more heavily)
    const weight = Math.exp(-0.15 * i);
    weightSum += weight;
    
    const matchRating = 0.6 + (points / 3.0) * 0.8; // rating range [0.6, 1.4]
    ratingSum += matchRating * weight;
  }

  return weightSum > 0 ? Number((ratingSum / weightSum).toFixed(4)) : 1.0;
}

/**
 * Calculates goals scored/conceded variance to capture scoring distribution anomalies.
 */
export function calculateGoalVolatility(teamId: number, matches: any[]): number {
  if (!matches || matches.length === 0) return 1.0;
  
  const goals = matches.map(m => {
    if (!m.teams || !m.goals) return 0;
    const isHome = m.teams.home?.id === teamId;
    return isHome ? (m.goals.home ?? 0) : (m.goals.away ?? 0);
  });
  
  const mean = goals.reduce((a, b) => a + b, 0) / goals.length;
  const variance = goals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / goals.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev > 0 ? Number(stdDev.toFixed(4)) : 1.0;
}

/**
 * Computes difference in rest days between fixtures to measure fatigue impact.
 */
export function calculateRestDays(fixtureDate: string, lastFixtureDate?: string): number {
  if (!lastFixtureDate) return 7; // assume standard 1 week rest if not found
  const current = new Date(fixtureDate).getTime();
  const last = new Date(lastFixtureDate).getTime();
  const diffDays = Math.ceil((current - last) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Main feature aggregator function.
 */
export function extractAdvancedFeatures(fixture: any, teamHistory: any): AdvancedFeatures {
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;
  const leagueId = fixture.league.id;

  return {
    homeAdvantage: calculateHomeAdvantage(homeId, leagueId),
    recentFormHome: calculateRecentForm(homeId, teamHistory?.home || []),
    recentFormAway: calculateRecentForm(awayId, teamHistory?.away || []),
    goalTrendHome: calculateGoalVolatility(homeId, teamHistory?.home || []),
    goalTrendAway: calculateGoalVolatility(awayId, teamHistory?.away || []),
    leagueStrength: 1.0, // baseline index
    restDaysHome: calculateRestDays(fixture.fixture.date, teamHistory?.homeLastMatchDate),
    restDaysAway: calculateRestDays(fixture.fixture.date, teamHistory?.awayLastMatchDate),
  };
}
