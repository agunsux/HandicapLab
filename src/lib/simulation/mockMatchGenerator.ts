import { MatchInput } from '@/services/probability.engine';

export interface MatchSimulationResult {
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  shHomeGoals: number;
  shAwayGoals: number;
  shTotalGoals: number;
  btts: boolean;
  homeWin: boolean;
  draw: boolean;
  awayWin: boolean;
}

function poissonRandom(lambda: number): number {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export interface DomainState {
  tempo: number;
  defensiveShapeHome: number;
  defensiveShapeAway: number;
  fatigueHome: number;
  fatigueAway: number;
  weather: number;
  pressure: number;
}

export function generateMockMatch(
  homeStrength: number = 1.5,
  awayStrength: number = 1.0,
  leagueProfile: { homeAdvantage: number; avgGoals: number } = { homeAdvantage: 0.3, avgGoals: 2.5 }
): { input: MatchInput, outcome: MatchSimulationResult, domain: DomainState } {
  // Generate random domain state variables between -1 and 1 (or 0 and 1)
  const domain: DomainState = {
    tempo: (Math.random() * 2) - 1, // -1 slow, 1 fast
    defensiveShapeHome: (Math.random() * 2) - 1, // -1 open, 1 solid
    defensiveShapeAway: (Math.random() * 2) - 1,
    fatigueHome: Math.random(), // 0 fresh, 1 tired
    fatigueAway: Math.random(),
    weather: (Math.random() * 2) - 1, // -1 bad, 1 perfect
    pressure: Math.random() // 0 low, 1 high stakes
  };

  const baseHomeLambda = Math.max(0.1, homeStrength + leagueProfile.homeAdvantage);
  const baseAwayLambda = Math.max(0.1, awayStrength);

  // Apply domain modifiers
  // Fast tempo increases goals, solid defensive shape decreases opponent goals, fatigue increases opponent goals
  const homeMod = (domain.tempo * 0.2) - (domain.defensiveShapeAway * 0.3) + (domain.fatigueAway * 0.2) + (domain.weather * 0.1);
  const awayMod = (domain.tempo * 0.2) - (domain.defensiveShapeHome * 0.3) + (domain.fatigueHome * 0.2) + (domain.weather * 0.1);

  const homeLambda = Math.max(0.1, baseHomeLambda + homeMod);
  const awayLambda = Math.max(0.1, baseAwayLambda + awayMod);

  const shHomeLambda = homeLambda * 0.55;
  const shAwayLambda = awayLambda * 0.55;
  const shHomeGoals = Math.min(poissonRandom(shHomeLambda), 5);
  const shAwayGoals = Math.min(poissonRandom(shAwayLambda), 5);
  const fhHomeGoals = Math.min(poissonRandom(homeLambda * 0.45), 5);
  const fhAwayGoals = Math.min(poissonRandom(awayLambda * 0.45), 5);
  const homeGoals = fhHomeGoals + shHomeGoals;
  const awayGoals = fhAwayGoals + shAwayGoals;
  const totalGoals = homeGoals + awayGoals;
  const shTotalGoals = shHomeGoals + shAwayGoals;

  const outcome: MatchSimulationResult = {
    homeGoals,
    awayGoals,
    totalGoals,
    shHomeGoals,
    shAwayGoals,
    shTotalGoals,
    btts: homeGoals > 0 && awayGoals > 0,
    homeWin: homeGoals > awayGoals,
    draw: homeGoals === awayGoals,
    awayWin: homeGoals < awayGoals,
  };

  // True Probabilities (approximations based on lambdas to create market line)
  const totalLambda = homeLambda + awayLambda;
  const trueHomeProb = homeLambda / totalLambda;
  const trueAwayProb = awayLambda / totalLambda;
  const trueDrawProb = 1 - (trueHomeProb + trueAwayProb); // Simplification, poisson is more complex

  // Market Generation (add 5% vig and noise)
  const noise = () => (Math.random() - 0.5) * 0.1; 
  
  const marketHomeProb = Math.max(0.01, trueHomeProb + noise());
  const marketAwayProb = Math.max(0.01, trueAwayProb + noise());
  const marketDrawProb = Math.max(0.01, trueDrawProb + noise());
  const sumMarket = marketHomeProb + marketAwayProb + marketDrawProb;
  const normalizedSum = sumMarket / 1.05; // 5% margin
  
  const oddsHome = 1 / (marketHomeProb / normalizedSum);
  const oddsDraw = 1 / (marketDrawProb / normalizedSum);
  const oddsAway = 1 / (marketAwayProb / normalizedSum);

  const input: MatchInput = {
    odds_home: oddsHome,
    odds_draw: oddsDraw,
    odds_away: oddsAway,
    ah_line: Math.round((homeLambda - awayLambda) * 4) / 4,
    ou_line: 2.5,
    btts_odds: 1.8 + Math.random() * 0.4,
    xg_home: parseFloat(homeLambda.toFixed(2)),
    xg_away: parseFloat(awayLambda.toFixed(2)),
    shots_home: Math.round(homeLambda * 8),
    shots_away: Math.round(awayLambda * 8),
    shots_on_target_home: Math.round(homeLambda * 3),
    shots_on_target_away: Math.round(awayLambda * 3),
    form_home: Math.floor(Math.random() * 6),
    form_away: Math.floor(Math.random() * 6),
    last_5_avg_goals_home: Math.max(0.5, baseHomeLambda + (Math.random() * 1.0 - 0.5)),
    last_5_avg_goals_away: Math.max(0.5, baseAwayLambda + (Math.random() * 1.0 - 0.5)),
    sh_ou_line: 1.0,
    sh_ou_odds_under: 1.91,
    domain_tempo: domain.tempo,
    domain_defensiveShapeHome: domain.defensiveShapeHome,
    domain_defensiveShapeAway: domain.defensiveShapeAway,
    domain_fatigueHome: domain.fatigueHome,
    domain_fatigueAway: domain.fatigueAway,
    domain_weather: domain.weather,
    domain_pressure: domain.pressure,
    ht_home_goals: fhHomeGoals,
    ht_away_goals: fhAwayGoals
  };

  return { input, outcome, domain };
}
