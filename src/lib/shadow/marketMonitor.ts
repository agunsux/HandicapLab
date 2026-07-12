/**
 * 21.4 — Live Market Monitor
 * Detects sharp movement, drift, steam, reversal, bookmaker disagreement.
 */

import type { MarketEvent, MarketEventType } from './types';
import { generateEventId } from './id';

export class MarketMonitor {
  private readonly events: MarketEvent[] = [];

  detect(input: { fixtureId: string; market: string; beforeOdds: number; afterOdds: number; timestamp: string }): MarketEvent | null {
    const magnitude = Math.abs(input.afterOdds - input.beforeOdds);
    const pctChange = input.beforeOdds > 0 ? magnitude / input.beforeOdds : 0;

    let type: MarketEventType | null = null;
    let confidence = 0;

    if (pctChange > 0.1) { type = 'sharp_movement'; confidence = 0.9; }
    else if (pctChange > 0.05) { type = 'drift'; confidence = 0.6; }
    else if (pctChange > 0.02) { type = 'volatility'; confidence = 0.3; }

    if (!type) return null;

    const event: MarketEvent = Object.freeze({
      eventId: generateEventId(),
      fixtureId: input.fixtureId,
      type,
      market: input.market,
      timestamp: input.timestamp,
      beforeOdds: input.beforeOdds,
      afterOdds: input.afterOdds,
      magnitude: Math.round(magnitude * 10000) / 10000,
      confidence: Math.round(confidence * 100) / 100,
      description: `${type}: ${input.beforeOdds} → ${input.afterOdds} (${(pctChange * 100).toFixed(1)}%)`,
    });
    this.events.push(event);
    return event;
  }

  getEvents(fixtureId: string): readonly MarketEvent[] {
    return this.events.filter((e) => e.fixtureId === fixtureId);
  }

  getAll(): readonly MarketEvent[] { return [...this.events]; }
}

export const defaultMarketMonitor = new MarketMonitor();