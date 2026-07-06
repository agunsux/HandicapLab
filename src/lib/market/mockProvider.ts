// HandicapLab Market Intelligence - Mock Provider
// Location: src/lib/market/mockProvider.ts

import { MarketDataProvider, OddsSnapshot, OddsMovementEvent, BookmakerMetadata } from './providerInterface';

export class MockMarketDataProvider implements MarketDataProvider {
  private static metadata: Record<string, BookmakerMetadata> = {
    Pinnacle: { id: 'pin', name: 'Pinnacle', country: 'Curaçao', marginAvg: 0.023, liquidityTier: 'High' },
    SBO: { id: 'sbo', name: 'SBOBET', country: 'Isle of Man', marginAvg: 0.035, liquidityTier: 'High' },
    Bet365: { id: '365', name: 'Bet365', country: 'United Kingdom', marginAvg: 0.052, liquidityTier: 'Medium' },
    Orbit: { id: 'orb', name: 'Orbit Exchange', country: 'Malta', marginAvg: 0.030, liquidityTier: 'High' },
    Betfair: { id: 'bf', name: 'Betfair', country: 'United Kingdom', marginAvg: 0.032, liquidityTier: 'High' },
    PS3838: { id: 'ps', name: 'PS3838', country: 'Curaçao', marginAvg: 0.024, liquidityTier: 'High' }
  };

  public async getBookmakerMetadata(bookmaker: string): Promise<BookmakerMetadata | null> {
    return MockMarketDataProvider.metadata[bookmaker] || null;
  }

  public async getOpeningOdds(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsSnapshot | null> {
    if (market === 'ML') {
      return { home: 2.10, draw: 3.30, away: 3.50 };
    } else if (market === 'AH') {
      return { home: 1.95, draw: 0, away: 1.95, line: -0.5 };
    } else {
      return { home: 1.90, draw: 0, away: 2.00, line: 2.5 };
    }
  }

  public async getCurrentOdds(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsSnapshot | null> {
    if (market === 'ML') {
      return { home: 1.95, draw: 3.40, away: 3.80 };
    } else if (market === 'AH') {
      return { home: 1.82, draw: 0, away: 2.10, line: -0.5 };
    } else {
      return { home: 1.80, draw: 0, away: 2.15, line: 2.5 };
    }
  }

  public async getClosingOdds(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsSnapshot | null> {
    if (market === 'ML') {
      return { home: 1.90, draw: 3.50, away: 4.00 };
    } else if (market === 'AH') {
      return { home: 1.78, draw: 0, away: 2.15, line: -0.5 };
    } else {
      return { home: 1.75, draw: 0, away: 2.20, line: 2.5 };
    }
  }

  public async getMarketHistory(matchId: string, bookmaker: string, market: 'ML' | 'AH' | 'OU'): Promise<OddsMovementEvent[]> {
    const baseTime = new Date('2026-07-06T12:00:00Z');
    
    // Simulate transitions: Opening -> Movement 1 -> Movement 2 -> Movement 3 -> Closing
    if (market === 'ML') {
      return [
        {
          id: 'evt-1',
          eventType: 'OddsOpened',
          timestamp: baseTime.toISOString(),
          bookmaker,
          market: 'ML',
          selection: 'home',
          oldOdds: 2.10,
          newOdds: 2.10,
          impliedProbability: 0.4762,
          movementMagnitude: 0,
          movementDirection: 'neutral'
        },
        {
          id: 'evt-2',
          eventType: 'OddsUpdated',
          timestamp: new Date(baseTime.getTime() + 2 * 3600 * 1000).toISOString(),
          bookmaker,
          market: 'ML',
          selection: 'home',
          oldOdds: 2.10,
          newOdds: 2.05,
          impliedProbability: 0.4878,
          movementMagnitude: 0.05,
          movementDirection: 'down'
        },
        {
          id: 'evt-3',
          eventType: 'OddsUpdated',
          timestamp: new Date(baseTime.getTime() + 4 * 3600 * 1000).toISOString(),
          bookmaker,
          market: 'ML',
          selection: 'home',
          oldOdds: 2.05,
          newOdds: 1.98,
          impliedProbability: 0.5051,
          movementMagnitude: 0.07,
          movementDirection: 'down'
        },
        {
          id: 'evt-4',
          eventType: 'OddsUpdated',
          timestamp: new Date(baseTime.getTime() + 6 * 3600 * 1000).toISOString(),
          bookmaker,
          market: 'ML',
          selection: 'home',
          oldOdds: 1.98,
          newOdds: 1.95,
          impliedProbability: 0.5128,
          movementMagnitude: 0.03,
          movementDirection: 'down'
        },
        {
          id: 'evt-5',
          eventType: 'OddsClosed',
          timestamp: new Date(baseTime.getTime() + 7 * 3600 * 1000).toISOString(),
          bookmaker,
          market: 'ML',
          selection: 'home',
          oldOdds: 1.95,
          newOdds: 1.90,
          impliedProbability: 0.5263,
          movementMagnitude: 0.05,
          movementDirection: 'down'
        }
      ];
    }

    // AH / OU default fallback lists
    return [];
  }
}
