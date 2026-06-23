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

export function generateMockMatch(
  homeStrength: number = 1.5,
  awayStrength: number = 1.0,
  leagueProfile: { homeAdvantage: number; avgGoals: number } = { homeAdvantage: 0.3, avgGoals: 2.5 }
): { input: MatchInput, outcome: MatchSimulationResult } {
  const homeLambda = Math.max(0.1, homeStrength + leagueProfile.homeAdvantage);
  const awayLambda = Math.max(0.1, awayStrength);

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

  const xgHome = Math.max(0.1, homeLambda + (Math.random() * 0.4 - 0.2));
  const xgAway = Math.max(0.1, awayLambda + (Math.random() * 0.4 - 0.2));

  const input: MatchInput = {
    odds_home: Math.max(1.01, 1 / (homeLambda / (homeLambda + awayLambda)) + Math.random() * 0.2),
    odds_draw: 3.5 + Math.random() * 1.0,
    odds_away: Math.max(1.01, 1 / (awayLambda / (homeLambda + awayLambda)) + Math.random() * 0.2),
    ah_line: Math.round((xgHome - xgAway) * 4) / 4,
    ou_line: 2.5,
    btts_odds: 1.8 + Math.random() * 0.4,
    xg_home: parseFloat(xgHome.toFixed(2)),
    xg_away: parseFloat(xgAway.toFixed(2)),
    shots_home: Math.round(xgHome * 8),
    shots_away: Math.round(xgAway * 8),
    shots_on_target_home: Math.round(xgHome * 3),
    shots_on_target_away: Math.round(xgAway * 3),
    form_home: Math.floor(Math.random() * 6),
    form_away: Math.floor(Math.random() * 6),
    last_5_avg_goals_home: Math.max(0.5, homeLambda + (Math.random() * 1.0 - 0.5)),
    last_5_avg_goals_away: Math.max(0.5, awayLambda + (Math.random() * 1.0 - 0.5)),
    sh_ou_line: 1.0,
    sh_ou_odds_under: 1.91 // ~4.5% vig
  };

  return { input, outcome };
}
