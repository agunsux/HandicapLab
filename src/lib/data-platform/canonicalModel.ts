// HandicapLab Live Data Platform - Canonical Data Model (CDM)
// Location: src/lib/data-platform/canonicalModel.ts

export interface CanonicalFixture {
  match_id: string;
  provider_id: string;
  provider: string;
  competition_id: string;
  season: string;
  
  home_team_id: string;
  away_team_id: string;
  kickoff: string; // ISO UTC format
  
  home_goals: number | null;
  away_goals: number | null;
  
  home_xg: number | null;
  away_xg: number | null;
  
  home_shots: number | null;
  away_shots: number | null;
  
  home_shots_on_target: number | null;
  away_shots_on_target: number | null;
  
  status: 'SCHEDULED' | 'LIVE' | 'SUSPENDED' | 'FINISHED';
  
  schema_version: string;
  generated_at: string;
  checksum: string;
}

export interface CanonicalOdds {
  fixtureId: string;
  provider: string;
  marketType: 'ML' | 'AH' | 'OU' | 'BTTS';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under' | 'btts_yes' | 'btts_no';
  line?: number | null;
  oddsDecimal: number;
  impliedProbability: number;
  receivedAt: string; // UTC receipt timestamp
  providerTimestamp: string; // original timestamp from the provider
  processedTimestamp: string; // processed timestamp
  latencyMs: number; // ingestion latency
  normalizerVersion: string;
}

export interface CanonicalTeam {
  id: string;
  name: string;
  shortName?: string;
}

export interface CanonicalPlayer {
  id: string;
  name: string;
  position: 'G' | 'D' | 'M' | 'F';
}

export interface CanonicalLineup {
  fixtureId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  position: string;
  role: 'STARTER' | 'SUBSTITUTE';
}

export interface CanonicalInjury {
  fixtureId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  injuryType: string;
  status: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE';
  expectedReturnDate?: string;
}

export interface CanonicalReferee {
  refereeName: string;
  date: string;
  matchId: string;
  yellowCards: number;
  redCards: number;
  foulsCalled: number;
}

export interface CanonicalTeamStats {
  fixtureId: string;
  teamName: string;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface CanonicalEvent {
  eventId: string;
  fixtureId: string;
  eventType: 'OddsOpened' | 'OddsUpdated' | 'OddsSuspended' | 'OddsReopened' | 'OddsClosed';
  occurredAt: string;
  payload: any;
  checksum: string;
  eventVersion: string;
  correlationId?: string;
}

export interface FeatureSnapshot {
  match_id: string;
  timestamp: string;
  features: Record<string, number | string>;
  feature_version: string;
}

export interface PredictionSnapshot {
  match_id: string;
  timestamp: string;
  model_version: string;
  calibration_version?: string;
  feature_version?: string;
  calibration_status?: string;
  market: 'moneyline' | 'asian_handicap' | 'over_under' | 'btts';
  selection: string; // e.g. 'home', 'away', 'draw', 'over', 'under', 'home_ah'
  probability: number;
  raw_probability?: number;
  win_probability?: number;
  push_probability?: number;
  loss_probability?: number;
  fair_odds: number;
  confidence: number;
  data_age_ms?: number;
  odds_snapshot_id?: string;
  feature_snapshot_id?: string;
}

export interface ValueAssessment {
  match_id: string;
  market: 'moneyline' | 'asian_handicap' | 'over_under' | 'btts';
  selection: string;
  line: number;
  market_odds: number;
  model_probability: number;
  fair_odds: number;
  implied_probability: number;
  edge: number;
  ev: number;
  value_flag: boolean;
  threshold_version: string;
  timestamp: string;
  reason?: string;
  rejection_reason?: string;
  calibration_status?: string;
  data_age_ms?: number;
  prediction_id?: string;
}
