// Moneyline (1X2) Prediction Engine
import { TeamModelStats } from './handicap-engine';

export interface MoneylineEngineInput {
  homeTeamStats: TeamModelStats;
  awayTeamStats: TeamModelStats;
  homeMarketOdds: number;
  drawMarketOdds: number;
  awayMarketOdds: number;
}

export interface MoneylineEngineOutput {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  homeFairOdds: number;
  drawFairOdds: number;
  awayFairOdds: number;
  recommendedOutcome: 'home' | 'draw' | 'away' | 'none';
  marketOdds: number;
  edgePercent: number;
  confidenceScore: number;
}

/**
 * Calculates Moneyline (1X2) probabilities and edges using statistical placeholders.
 * Prepared for a Poisson distribution model implementation.
 */
export function calculateMoneylineEdge(input: MoneylineEngineInput): MoneylineEngineOutput {
  const { homeTeamStats, awayTeamStats, homeMarketOdds, drawMarketOdds, awayMarketOdds } = input;

  // Expected goal scoring capabilities
  const expectedHomeGoals = (homeTeamStats.goalsFor + awayTeamStats.goalsAgainst) / 2;
  const expectedAwayGoals = (awayTeamStats.goalsFor + homeTeamStats.goalsAgainst) / 2;

  // Basic probability draft based on goal averages
  const totalExpGoals = expectedHomeGoals + expectedAwayGoals;
  
  // Calculate relative strength
  const homeRatio = expectedHomeGoals / (totalExpGoals || 1);
  const awayRatio = expectedAwayGoals / (totalExpGoals || 1);

  // Distribute probabilities (draw is base 25%, scaled with defensive style)
  const drawProb = 0.25;
  const remainingProb = 1 - drawProb;

  let homeProb = remainingProb * homeRatio + 0.1; // home advantage factor (+10%)
  let awayProb = remainingProb * awayRatio - 0.1;

  // Clamp and normalize
  homeProb = Math.max(0.05, Math.min(0.9, homeProb));
  awayProb = Math.max(0.05, Math.min(0.9, awayProb));
  
  const sum = homeProb + awayProb + drawProb;
  const homeProbNorm = Number((homeProb / sum).toFixed(4));
  const drawProbNorm = Number((drawProb / sum).toFixed(4));
  const awayProbNorm = Number((awayProb / sum).toFixed(4));

  const homeFairOdds = Number((1 / homeProbNorm).toFixed(2));
  const drawFairOdds = Number((1 / drawProbNorm).toFixed(2));
  const awayFairOdds = Number((1 / awayProbNorm).toFixed(2));

  const homeEdge = Number(((homeMarketOdds * homeProbNorm) - 1) * 100);
  const drawEdge = Number(((drawMarketOdds * drawProbNorm) - 1) * 100);
  const awayEdge = Number(((awayMarketOdds * awayProbNorm) - 1) * 100);

  // Form score calculation
  const getFormScore = (form: ('W' | 'D' | 'L')[]) => {
    const last5 = form.slice(-5);
    if (last5.length === 0) return 50;
    const points = last5.reduce((acc, curr) => acc + (curr === 'W' ? 3 : curr === 'D' ? 1 : 0), 0);
    return (points / 15) * 100;
  };

  const homeForm = getFormScore(homeTeamStats.formOutcomes);
  const awayForm = getFormScore(awayTeamStats.formOutcomes);
  const confidenceScore = Math.round((homeForm * 0.6) + (awayForm * 0.4));

  // Determine which outcome has the highest positive edge
  const edges = [
    { outcome: 'home', edge: homeEdge, odds: homeMarketOdds },
    { outcome: 'draw', edge: drawEdge, odds: drawMarketOdds },
    { outcome: 'away', edge: awayEdge, odds: awayMarketOdds }
  ] as const;

  const bestEdge = edges.reduce((prev, current) => (current.edge > prev.edge ? current : prev), {
    outcome: 'none',
    edge: 0,
    odds: 1.0,
  } as { outcome: 'home' | 'draw' | 'away' | 'none'; edge: number; odds: number });

  return {
    homeProbability: homeProbNorm,
    drawProbability: drawProbNorm,
    awayProbability: awayProbNorm,
    homeFairOdds,
    drawFairOdds,
    awayFairOdds,
    recommendedOutcome: bestEdge.outcome,
    marketOdds: bestEdge.odds,
    edgePercent: Number(bestEdge.edge.toFixed(2)),
    confidenceScore,
  };
}
