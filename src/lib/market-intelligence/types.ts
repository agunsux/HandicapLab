// HandicapLab Market Intelligence - Core Types
// Location: src/lib/market-intelligence/types.ts

// --- Odds Data Structures ---

export interface OddsLine {
  home: number;
  draw: number;
  away: number;
}

export interface OddsSnapshot {
  timestamp: Date;
  moneyline: OddsLine;
  // Extensible for overUnder, asianHandicap etc.
}

export interface OddsTimeline {
  matchId: string;
  provider: string; // e.g. "Pinnacle", "Bet365"
  opening: OddsSnapshot;
  current: OddsSnapshot; // The latest valid pre-match odds
  closing?: OddsSnapshot; // Optional: Only available post-match
  history: OddsSnapshot[]; // Sorted array of snapshots over time
}

// --- Provider Abstraction ---

export interface OddsProvider {
  id: string;
  name: string;
  fetchTimeline(matchId: string): Promise<OddsTimeline | null>;
}

// --- Physical Separation of Features ---

/**
 * PREMATCH FEATURES (Prediction Features)
 * MUST NOT contain any data that requires the match to start or finish.
 */
export interface PredictionFeatures {
  openingOdds: OddsLine;
  currentOdds: OddsLine;
  deltaImplied: {
    home: number;
    draw: number;
    away: number;
  };
  steamScore: number; // 0 to 100
  marketRegime: 'Stable' | 'Volatile' | 'Steam' | 'Mixed';
  marketConfidence: number; // 0 to 100
  anomalies: string[]; // e.g. ['Steam', 'Reverse Line Movement']
}

/**
 * EVALUATION FEATURES
 * EXCLUSIVELY used post-match.
 */
export interface EvaluationFeatures {
  closingOdds: OddsLine;
  rawCLV: number;
  normalizedCLV: number;
  logCLV: number;
  evAdjustedCLV: number;
}
