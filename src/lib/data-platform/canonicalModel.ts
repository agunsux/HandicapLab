// HandicapLab Live Data Platform - Canonical Data Model (CDM)
// Location: src/lib/data-platform/canonicalModel.ts

export interface CanonicalFixture {
  id: string; // CDM standard UUID/standard identifier
  providerId: string; // original ID from bookmaker
  provider: string; // Pinnacle, SBO, Bet365, Orbit, Mock, File
  competition: {
    id: string;
    name: string;
    region: string;
  };
  homeTeam: {
    id: string;
    name: string;
  };
  awayTeam: {
    id: string;
    name: string;
  };
  kickoffTime: string; // ISO UTC format
  status: 'SCHEDULED' | 'LIVE' | 'SUSPENDED' | 'FINISHED';
  schemaVersion: string;
  referee?: string;
  fullTimeHomeGoals?: number | null;
  fullTimeAwayGoals?: number | null;
}

export interface CanonicalOdds {
  fixtureId: string;
  provider: string;
  marketType: 'ML' | 'AH' | 'OU';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under';
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
