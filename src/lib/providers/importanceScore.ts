// Importance Score Calculator
// Determines if a fixture is worth spending API-Football quota on.

export interface FixtureContext {
  leagueId: number;
  leagueType: 'League' | 'Cup' | 'Friendly';
  kickoffTime: string; // ISO String
  availableMarkets: string[]; // ['h2h', 'spreads', 'totals', 'btts']
  availableBookmakers: string[]; // ['pinnacle', 'circasports', 'sbobet']
  modelExpectedValue?: number; // Pre-calculated EV % (e.g., 3.5 for 3.5%)
}

// Fixed weights as requested in EPIC 57.1
export const IMPORTANCE_WEIGHTS = {
  TOP_EUROPEAN_LEAGUE: 35,
  MAJOR_CUP_COMPETITION: 30,
  KICKOFF_LT_180_MINS: 20,
  ALL_FOUR_MARKETS: 10,
  TWO_PLUS_PRIMARY_BOOKMAKERS: 10,
  MODEL_EV_GTE_3_PCT: 15,
};

export const ENRICHMENT_THRESHOLD = 70;

const TOP_LEAGUES = new Set([39, 140, 135, 78, 61]); // Premier League, La Liga, Serie A, Bundesliga, Ligue 1
const MAJOR_CUPS = new Set([2, 3, 848, 4, 15, 45, 48]); // Champions League, Europa, World Cup, Euro, Copa America, FA Cup, Copa del Rey

export function calculateImportanceScore(ctx: FixtureContext): number {
  let score = 0;

  // 1. Top European League
  if (ctx.leagueType === 'League' && TOP_LEAGUES.has(ctx.leagueId)) {
    score += IMPORTANCE_WEIGHTS.TOP_EUROPEAN_LEAGUE;
  }

  // 2. Major Cup Competition
  if (ctx.leagueType === 'Cup' && MAJOR_CUPS.has(ctx.leagueId)) {
    score += IMPORTANCE_WEIGHTS.MAJOR_CUP_COMPETITION;
  }

  // 3. Kickoff < 180 minutes
  const now = new Date().getTime();
  const kickoff = new Date(ctx.kickoffTime).getTime();
  const minutesUntilKickoff = (kickoff - now) / 60000;
  
  if (minutesUntilKickoff >= 0 && minutesUntilKickoff < 180) {
    score += IMPORTANCE_WEIGHTS.KICKOFF_LT_180_MINS;
  }

  // 4. All four markets available
  const requiredMarkets = ['h2h', 'spreads', 'totals', 'btts'];
  const hasAllMarkets = requiredMarkets.every(m => ctx.availableMarkets.includes(m));
  if (hasAllMarkets) {
    score += IMPORTANCE_WEIGHTS.ALL_FOUR_MARKETS;
  }

  // 5. Odds from at least two primary bookmakers
  const primaryBookmakers = ['pinnacle', 'circasports', 'sbobet'];
  const primaryCount = ctx.availableBookmakers.filter(b => primaryBookmakers.includes(b)).length;
  if (primaryCount >= 2) {
    score += IMPORTANCE_WEIGHTS.TWO_PLUS_PRIMARY_BOOKMAKERS;
  }

  // 6. Model Expected Value >= 3%
  if (ctx.modelExpectedValue !== undefined && ctx.modelExpectedValue >= 3) {
    score += IMPORTANCE_WEIGHTS.MODEL_EV_GTE_3_PCT;
  }

  return Math.min(score, 120);
}

export function shouldEnrichFixture(ctx: FixtureContext): boolean {
  return calculateImportanceScore(ctx) >= ENRICHMENT_THRESHOLD;
}
