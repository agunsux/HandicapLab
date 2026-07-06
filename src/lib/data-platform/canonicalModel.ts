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
