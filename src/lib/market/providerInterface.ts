// HandicapLab Market Intelligence - Provider Interface
// Location: src/lib/market/providerInterface.ts

export interface OddsSnapshot {
  home: number;
  draw: number;
  away: number;
  line?: number | null;
}

export interface OddsMovementEvent {
  id: string;
  eventType: 'OddsOpened' | 'OddsUpdated' | 'OddsSuspended' | 'OddsReopened' | 'OddsClosed';
  timestamp: string;
  bookmaker: string;
  market: 'ML' | 'AH' | 'OU';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under';
  oldOdds: number;
  newOdds: number;
  impliedProbability: number;
  movementMagnitude: number;
  movementDirection: 'up' | 'down' | 'neutral';
}

export interface BookmakerMetadata {
  id: string;
  name: string;
  country: string;
  marginAvg: number;
  liquidityTier: 'High' | 'Medium' | 'Low';
}

export interface MarketDataProvider {
  getOpeningOdds(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsSnapshot | null>;
  getCurrentOdds(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsSnapshot | null>;
  getClosingOdds(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsSnapshot | null>;
  getMarketHistory(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsMovementEvent[]>;
  getBookmakerMetadata(bookmaker: string): Promise<BookmakerMetadata | null>;
}
