// ============================================================================
// CANONICAL RESEARCH STATE CONTRACTS & DATA SEPARATION
// ============================================================================
// Location: src/lib/research/market-state/types.ts
//
// Strictly separates:
//   1. FOOTBALL STATE  (fixtures, results, standings, stats, lineups)
//   2. MARKET STATE    (bookmakers, markets, lines, odds, ticks, timestamps)
//   3. MODEL STATE     (model versions, parameters, feature snapshots, probabilities)
//
// Each state carries independent provenance metadata.
// ============================================================================

export type ResearchMarketType = 'AH' | 'OU' | 'BTTS' | 'ML';
export type ResearchSelectionSide = 'home' | 'draw' | 'away' | 'over' | 'under' | 'yes' | 'no';

export type PredictionHorizon =
  | 'T_7D'   // ~7 days before kickoff (Opening era)
  | 'T_72H'  // ~72 hours before kickoff
  | 'T_24H'  // ~24 hours before kickoff
  | 'T_6H'   // ~6 hours before kickoff
  | 'T_1H'   // ~1 hour before kickoff (Lineup announcement era)
  | 'T_15M';  // Closing window [T - 15m, T]

export interface StateProvenance {
  sourceProvider: string;     // e.g. 'oddspapi', 'api-football', 'football-data.co.uk'
  sourceId: string;           // Provider-specific ID
  sourceFile?: string;        // Local file or cache path
  capturedAt: string;         // ISO timestamp of ingestion
  schemaVersion: string;
}

// ----------------------------------------------------------------------------
// 1. FOOTBALL STATE
// ----------------------------------------------------------------------------
export interface FootballMatchFact {
  canonicalMatchId: string;
  leagueId: string;
  season: string;
  kickoffTime: string;        // ISO 8601 UTC
  homeTeam: string;
  awayTeam: string;
  status: 'SCHEDULED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  result?: {
    fullTimeHomeGoals: number;
    fullTimeAwayGoals: number;
    halfTimeHomeGoals?: number;
    halfTimeAwayGoals?: number;
    outcome1X2: '1' | 'X' | '2';
    totalGoals: number;
    btts: boolean;
  };
  teamStats?: Record<string, any>;
  lineups?: {
    homeStarting11?: string[];
    awayStarting11?: string[];
    confirmedAt?: string;
  };
  provenance: StateProvenance;
}

// ----------------------------------------------------------------------------
// 2. MARKET STATE
// ----------------------------------------------------------------------------
export interface MarketPricePoint {
  price: number;
  providerTimestamp: string;  // Exactly as reported by bookmaker/provider
  limit?: number | null;
  active: boolean;
}

export interface MarketStateObservation {
  matchId: string;
  horizon: PredictionHorizon;
  bookmaker: string;          // e.g. 'pinnacle', 'sbobet'
  market: ResearchMarketType;
  selection: ResearchSelectionSide;
  line: number | null;        // Exact numerical line (e.g. -0.25, 2.75, null for 1X2/BTTS)
  odds: number;               // Decimal odds
  providerTimestamp: string;
  captureTimestamp: string;
  source: string;
  provenance: StateProvenance;
}

export interface HorizonMarketSnapshot {
  matchId: string;
  horizon: PredictionHorizon;
  targetOffsetMs: number;
  windowStart: string;
  windowEnd: string;
  capturedAt: string | null;
  observations: MarketStateObservation[];
  inPlayRejectedCount: number;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING_SNAPSHOT';
}

// ----------------------------------------------------------------------------
// 3. MODEL STATE
// ----------------------------------------------------------------------------
export interface ModelDerivedProbability {
  market: ResearchMarketType;
  line: number | null;
  selection: ResearchSelectionSide;
  modelProbability: number;
  fairOdds: number;
  marketOdds: number;
  expectedValue: number;
  edge: number;
}

export interface ModelPredictionState {
  predictionId: string;
  matchId: string;
  modelVersion: string;
  horizon: PredictionHorizon;
  predictionTimestamp: string;
  fittedParameters: {
    homeAttack: number;
    awayAttack: number;
    homeDefense: number;
    awayDefense: number;
    homeAdvantage: number;
    leagueBaseline: number;
    rho: number; // dynamically fitted low-score correlation
  };
  featureSnapshot: Record<string, number | string | boolean>;
  marketSnapshotRef: string;
  probabilities: ModelDerivedProbability[];
  provenance: StateProvenance;
}

