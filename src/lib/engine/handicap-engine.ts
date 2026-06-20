// Asian Handicap Prediction Engine

export interface TeamModelStats {
  goalsFor: number;
  goalsAgainst: number;
  formOutcomes: ('W' | 'D' | 'L')[];
}

export interface HandicapEngineInput {
  homeTeamStats: TeamModelStats;
  awayTeamStats: TeamModelStats;
  handicapLine: number; // e.g. -0.25, 0.5, -1.0
  homeMarketOdds: number; // e.g. 1.95
  awayMarketOdds: number; // e.g. 1.90
}

export interface HandicapEngineOutput {
  handicapLine: number;
  recommendedOutcome: 'home' | 'away' | 'none';
  probability: number; // probability of winning/covering the line
  fairOdds: number; // 1 / probability
  marketOdds: number; // market odds for the selected side
  edgePercent: number; // (marketOdds * probability) - 1
  confidenceScore: number; // 0 to 100
}

/**
 * Calculates Asian Handicap edge and probability using placeholder statistical parameters.
 * Prepared for a Poisson distribution model implementation.
 */
export function calculateHandicapEdge(input: HandicapEngineInput): HandicapEngineOutput {
  const { homeTeamStats, awayTeamStats, handicapLine, homeMarketOdds, awayMarketOdds } = input;

  // Placeholder logic simulating Poisson goal expectations:
  // Expected goals home = home GF + away GA averaged
  const expectedHomeGoals = (homeTeamStats.goalsFor + awayTeamStats.goalsAgainst) / 2;
  const expectedAwayGoals = (awayTeamStats.goalsFor + homeTeamStats.goalsAgainst) / 2;

  // The goal difference expected:
  const goalDiff = expectedHomeGoals - expectedAwayGoals;

  // Simple probability mapping relative to handicap line and goal difference:
  // If line is home-negative (e.g. -0.25), home needs to win. Expected goal difference helps determine probability.
  let homeCoverProb = 0.5 + goalDiff * 0.15 - handicapLine * 0.12;
  homeCoverProb = Math.max(0.1, Math.min(0.9, homeCoverProb)); // clamp between 10% and 90%

  const awayCoverProb = 1 - homeCoverProb;

  // Compare fair odds vs market odds to find the edge
  const homeFairOdds = Number((1 / homeCoverProb).toFixed(2));
  const awayFairOdds = Number((1 / awayCoverProb).toFixed(2));

  const homeEdge = Number(((homeMarketOdds * homeCoverProb) - 1) * 100);
  const awayEdge = Number(((awayMarketOdds * awayCoverProb) - 1) * 100);

  // Form score (0 - 100) based on last 5 games
  const getFormScore = (form: ('W' | 'D' | 'L')[]) => {
    const last5 = form.slice(-5);
    if (last5.length === 0) return 50;
    const points = last5.reduce((acc, curr) => acc + (curr === 'W' ? 3 : curr === 'D' ? 1 : 0), 0);
    return (points / 15) * 100;
  };

  const homeForm = getFormScore(homeTeamStats.formOutcomes);
  const awayForm = getFormScore(awayTeamStats.formOutcomes);
  const confidenceScore = Math.round((homeForm + awayForm) / 2);

  if (homeEdge > awayEdge && homeEdge > 0) {
    return {
      handicapLine,
      recommendedOutcome: 'home',
      probability: Number(homeCoverProb.toFixed(4)),
      fairOdds: homeFairOdds,
      marketOdds: homeMarketOdds,
      edgePercent: Number(homeEdge.toFixed(2)),
      confidenceScore,
    };
  } else if (awayEdge > 0) {
    return {
      handicapLine,
      recommendedOutcome: 'away',
      probability: Number(awayCoverProb.toFixed(4)),
      fairOdds: awayFairOdds,
      marketOdds: awayMarketOdds,
      edgePercent: Number(awayEdge.toFixed(2)),
      confidenceScore,
    };
  }

  return {
    handicapLine,
    recommendedOutcome: 'none',
    probability: Number(homeCoverProb.toFixed(4)),
    fairOdds: homeFairOdds,
    marketOdds: homeMarketOdds,
    edgePercent: Number(homeEdge.toFixed(2)),
    confidenceScore,
  };
}
