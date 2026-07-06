// HandicapLab Market Intelligence - Event Sourcing Types
// Location: src/lib/market/marketEvents.ts

import { OddsSnapshot } from './providerInterface';

export type MarketEventType = 
  | 'OddsOpened'
  | 'OddsUpdated'
  | 'OddsSuspended'
  | 'OddsReopened'
  | 'OddsClosed';

export interface MarketEvent {
  id: string;
  matchId: string;
  eventType: MarketEventType;
  timestamp: string;
  bookmaker: string;
  market: 'ML' | 'AH' | 'OU';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under';
  odds: number;
  line?: number | null;
  impliedProbability: number;
  correlationId: string;
}

export class MarketEventStore {
  private static events: MarketEvent[] = [];

  /**
   * Appends an immutable event to the store.
   */
  public static append(event: MarketEvent): void {
    this.events.push(event);
  }

  /**
   * Retrieves all events for a given matchId.
   */
  public static getEventsForMatch(matchId: string): MarketEvent[] {
    return this.events.filter((e) => e.matchId === matchId);
  }

  /**
   * Clears the event store (primarily for tests).
   */
  public static clear(): void {
    this.events = [];
  }
}
