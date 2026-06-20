// Over/Under Goals Prediction Engine
import { TeamModelStats } from './handicap-engine';

export interface OUEngineInput {
  homeTeamStats: TeamModelStats;
  awayTeamStats: TeamModelStats;
  totalLine: number; // e.g. 2.5, 3.0
  overMarketOdds: number;
  underMarketOdds: number;
}

export interface OUEngineOutput {
  totalLine: number;
  overProbability: number;
  underProbability: number;
  overFairOdds: number;
  underFairOdds: number;
  recommendedOutcome: 'over' | 'under' | 'none';
  marketOdds: number;
  edgePercent: number;
  confidenceScore: number;
}

/**
 * Calculates Over/Under total goals probabilities and edges using statistical placeholders.
 * Prepared for a Poisson distribution model implementation.
 */
export function calculateOUEdge(input: OUEngineInput): OUEngineOutput {
  const { homeTeamStats, awayTeamStats, totalLine, overMarketOdds, underMarketOdds } = input;

  // Expected combined goals based on history
  const expectedHomeGoals = (homeTeamStats.goalsFor + awayTeamStats.goalsAgainst) / 2;
  const expectedAwayGoals = (awayTeamStats.goalsFor + homeTeamStats.goalsAgainst) / 2;
  const expectedTotalGoals = expectedHomeGoals + expectedAwayGoals;

  // Rough estimation of probability using expected totals vs line:
  // e.g. if expected total goals is 3.1 and line is 2.5, probability of over is high
  let overProb = 0.5 + (expectedTotalGoals - totalLine) * 0.25;
  overProb = Math.max(0.05, Math.min(0.95, overProb)); // clamp between 5% and 95%

  const underProb = 1 - overProb;

  const overFairOdds = Number((1 / overProb).toFixed(2));
  const underFairOdds = Number((1 / underProb).toFixed(2));

  const overEdge = Number(((overMarketOdds * overProb) - 1) * 100);
  const underEdge = Number(((underMarketOdds * underProb) - 1) * 100);

  // Confidence based on historical goal variance (simulated)
  const homeGoalVariance = Math.abs(homeTeamStats.goalsFor - homeTeamStats.goalsAgainst);
  const awayGoalVariance = Math.abs(awayTeamStats.goalsFor - awayTeamStats.goalsAgainst);
  const confidenceScore = Math.max(40, Math.min(95, Math.round(100 - (homeGoalVariance + awayGoalVariance) * 15)));

  if (overEdge > underEdge && overEdge > 0) {
    return {
      totalLine,
      overProbability: Number(overProb.toFixed(4)),
      underProbability: Number(underProb.toFixed(4)),
      overFairOdds,
      underFairOdds,
      recommendedOutcome: 'over',
      marketOdds: overMarketOdds,
      edgePercent: Number(overEdge.toFixed(2)),
      confidenceScore,
    };
  } else if (underEdge > 0) {
    return {
      totalLine,
      overProbability: Number(overProb.toFixed(4)),
      underProbability: Number(underProb.toFixed(4)),
      overFairOdds,
      underFairOdds,
      recommendedOutcome: 'under',
      marketOdds: underMarketOdds,
      edgePercent: Number(underEdge.toFixed(2)),
      confidenceScore,
    };
  }

  return {
    totalLine,
    overProbability: Number(overProb.toFixed(4)),
    underProbability: Number(underProb.toFixed(4)),
    overFairOdds,
    underFairOdds,
    recommendedOutcome: 'none',
    marketOdds: overMarketOdds,
    edgePercent: Number(overEdge.toFixed(2)),
    confidenceScore,
  };
}
