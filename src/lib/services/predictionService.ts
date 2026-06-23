import { calculatePreMatchFeatures } from '../data/dataTransformer';
import { 
  calculateMatchOutcomeProbabilities, 
  calculateAsianHandicapProbabilities, 
  calculateOverUnderProbabilities 
} from '../model/poisson';
import { mapConfidence } from '../confidence';

export function calculateExpectedGoals(features: any) {
  // Base expectation
  let home = 1.35;
  let away = 1.15;

  // Adjust using relative team strength and form
  const strengthAdjustHome = Math.max(0.5, Math.min(2.0, features.homeTeamStrength / (features.awayTeamStrength || 1.0)));
  const strengthAdjustAway = Math.max(0.5, Math.min(2.0, features.awayTeamStrength / (features.homeTeamStrength || 1.0)));
  
  const formAdjustHome = Math.max(0.6, Math.min(1.8, features.homeForm / 1.5));
  const formAdjustAway = Math.max(0.6, Math.min(1.8, features.awayForm / 1.5));

  home = home * strengthAdjustHome * formAdjustHome;
  away = away * strengthAdjustAway * formAdjustAway;

  return { home, away };
}

export const MODEL_VERSION = "prematch-v1";
export const FEATURE_VERSION = "basic-v1";

export async function generatePredictions(fixtures: any[]) {
  const predictions = [];
  
  for (const fixture of fixtures) {
    // Calculate pre-match features
    const features = calculatePreMatchFeatures(fixture);
    
    // Calculate expected goals using Poisson
    const expectedGoals = calculateExpectedGoals(features);
    
    // Calculate probabilities
    const outcomeProbs = calculateMatchOutcomeProbabilities(expectedGoals);
    const ahProbs = calculateAsianHandicapProbabilities(expectedGoals, -0.75);
    const ouProbs = calculateOverUnderProbabilities(expectedGoals, 2.5);
    
    // Determine confidence based on maximum probability across ML outcomes
    const maxProb = Math.max(outcomeProbs.homeWin, outcomeProbs.draw, outcomeProbs.awayWin);
    const confidence = mapConfidence(maxProb);
    
    predictions.push({
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      kickoffTime: fixture.fixture.date,
      league: fixture.league.name,
      homeWinProb: outcomeProbs.homeWin,
      drawProb: outcomeProbs.draw,
      awayWinProb: outcomeProbs.awayWin,
      ahLine: -0.75,
      ahHomeProb: ahProbs.homeCover,
      ouLine: 2.5,
      overProb: ouProbs.over,
      underProb: ouProbs.under,
      expectedGoals: Number((expectedGoals.home + expectedGoals.away).toFixed(2)),
      confidenceLevel: confidence,
      modelVersion: MODEL_VERSION,
      featureVersion: FEATURE_VERSION,
      generatedAt: new Date().toISOString(),
      predictionTimestamp: fixture.fixture.date,
      oddsSnapshot: {
        market: "AH",
        line: -0.75,
        homeOdds: 1.90,
        awayOdds: 1.90
      }
    });
  }
  
  return predictions;
}

