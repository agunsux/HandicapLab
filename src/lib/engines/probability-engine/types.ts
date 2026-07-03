import { MatchFeatures } from '../feature-engine/types';

export interface ModelVersion {
  name: string;          // "prematch-v1"
  algo: string;          // "dixon-coles"
  features: string;      // "basic-v1"
  trainedAt: Date;
  trainedOnMatches: number;
}

export interface ProbabilityOutput {
  matchId: string;
  marketType: 'AH' | 'OU' | 'ML';
  leagueId?: string;
  
  // Moneyline (1X2)
  pHome: number;
  pDraw: number;
  pAway: number;
  
  // Over/Under (multiple lines)
  pOver: Record<string, number>;   // { '2.5': 0.58, '1.5': 0.74 }
  pUnder: Record<string, number>;
  
  // Asian Handicap (multiple lines)
  pAhHome: Record<string, number>; // { '-0.5': 0.52, '-1.0': 0.38 }
  pAhAway: Record<string, number>;
  
  // Both Teams To Score (BTTS) & Expected Goals
  pBttsYes?: number;
  pBttsNo?: number;
  expectedGoals?: number;

  // Metadata
  modelVersion: ModelVersion;
  calibrationApplied: boolean;
  confidence?: {
    modelConfidence: number;
    dataConfidence: number;
    marketConfidence: number;
    finalConfidence: number;
    confidenceScore: number;
    dataQualityScore: number;
    recommendationStatus: 'Recommended' | 'Consider' | 'Neutral' | 'Caution' | 'Skip';
    reasons: string[];
  };
}

export interface RawProbabilities {
  homeLambda: number;
  awayLambda: number;
  scoreMatrix: number[][]; // 11x11 score grid (0 to 10 goals)
}
