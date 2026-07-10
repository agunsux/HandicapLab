import { Recommendation } from './types';

export interface AlternativeRecommendation {
  title: string;
  reason: string;
  riskDifference: 'lower' | 'similar' | 'higher';
  confidenceDifference: number;
}

export function getAlternatives(marketType: string, confidence: number): AlternativeRecommendation[] {
  const alts: AlternativeRecommendation[] = [];
  if (marketType === 'AH') {
    alts.push({ title: 'Moneyline (ML)', reason: 'Simpler market, lower variance, slightly lower edge', riskDifference: 'lower', confidenceDifference: 5 });
    alts.push({ title: 'Over/Under', reason: 'Uncorrelated opportunity, portfolio diversification', riskDifference: 'similar', confidenceDifference: -10 });
  } else if (marketType === 'ML') {
    alts.push({ title: 'Asian Handicap', reason: 'Better value when line is favorable', riskDifference: 'higher', confidenceDifference: -5 });
    alts.push({ title: 'Under 2.5 Goals', reason: 'Alternative if goals are expected to be limited', riskDifference: 'similar', confidenceDifference: -10 });
  } else if (marketType === 'OU') {
    alts.push({ title: 'Asian Handicap', reason: 'More precise market for match dynamics', riskDifference: 'similar', confidenceDifference: -8 });
    alts.push({ title: 'BTTS Yes', reason: 'Related market, higher variance', riskDifference: 'higher', confidenceDifference: -12 });
  } else {
    alts.push({ title: 'Asian Handicap -0.5', reason: 'Standard market for match outcome', riskDifference: 'similar', confidenceDifference: -5 });
    alts.push({ title: 'Over 2.5 Goals', reason: 'Alternative if goals expected', riskDifference: 'higher', confidenceDifference: -15 });
  }
  if (confidence < 60) {
    alts.push({ title: 'No bet', reason: 'Confidence below threshold — capital preservation', riskDifference: 'lower', confidenceDifference: 0 });
  }
  return alts;
}
