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
  // TODO: Query historical home vs away performance metrics
  return 1.15; // default baseline factor
}

/**
 * Computes opponent-adjusted recent form rating with recency decay.
 */
export function calculateRecentForm(teamId: number, matches: any[], matchesCount = 5): number {
  // TODO: Settle exponential decay average of points earned, weighted by opponent rating
  return 1.0;
}

/**
 * Calculates goals scored/conceded variance to capture scoring distribution anomalies.
 */
export function calculateGoalVolatility(teamId: number, matches: any[]): number {
  // TODO: Compute standard deviation of goals relative to Poisson mean
  return 1.0;
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
