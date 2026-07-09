// Shared types for all data providers — Market Intelligence System
// No provider-specific implementation lives here.

export type MarketType = 'asian_handicap' | 'over_under' | 'moneyline';

export type Side = 'home' | 'away' | 'draw';

export type MarketSelection = 'home' | 'away' | 'draw' | 'over' | 'under';

export interface Fixture {
  fixtureId: string;
  league: string;
  season: string;
  tournamentStage: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
  status?: 'upcoming' | 'live' | 'finished' | 'cancelled';
  homeScore?: number | null;
  awayScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OddsSnapshot {
  id: string;
  fixtureId: string;
  bookmaker: string;
  marketType: MarketType;
  line: number;
  priceHome: number;
  priceAway: number;
  priceDraw: number | null;
  capturedAt: Date;
  providerName: string;
  rawResponseHash: string;
}

export interface Result {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  settledAt: Date;
  source: string;
}

export interface ProviderFixtureQuery {
  leagues?: string[];
  fromDate?: Date;
  toDate?: Date;
  status?: 'upcoming' | 'live' | 'finished';
}

export interface ProviderOddsQuery {
  fixtureIds?: string[];
  marketTypes?: MarketType[];
  bookmakers?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
}

/** Normalized market with vig removed */
export interface NormalizedMarket {
  marketType: MarketType;
  line: number;
  homeProb: number;
  awayProb: number;
  drawProb: number | null;
  homeOdds: number;
  awayOdds: number;
  drawOdds: number | null;
  vig: number;
}

export interface HealthStatus {
  healthy: boolean;
  provider: string;
  latencyMs?: number;
  error?: string;
  lastChecked: Date;
}

/** Provider-independent interface for fetching fixtures */
export interface IFixturesProvider {
  name: string;
  fetchFixtures(query: ProviderFixtureQuery): Promise<Fixture[]>;
  healthCheck(): Promise<boolean>;
  getHealthStatus?(): Promise<HealthStatus>;
}

/** Provider-independent interface for fetching and normalizing odds */
export interface IOddsProvider {
  name: string;
  fetchOdds(query: ProviderOddsQuery): Promise<OddsSnapshot[]>;
  normalizeMarket(snapshot: OddsSnapshot): NormalizedMarket;
  healthCheck(): Promise<boolean>;
  getHealthStatus?(): Promise<HealthStatus>;
}

/** Provider-independent interface for fetching results */
export interface IResultsProvider {
  name: string;
  fetchResults(fixtureIds: string[]): Promise<Result[]>;
  healthCheck(): Promise<boolean>;
  getHealthStatus?(): Promise<HealthStatus>;
}
