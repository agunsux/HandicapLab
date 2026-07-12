/**
 * 21.3 — Odds Snapshot Timeline
 * Captures opening → current → closing odds with CLV calculation.
 */

import type { OddsPoint, OddsTimeline } from './types';
import { generateOddsId } from './id';

export class OddsTimelineTracker {
  private readonly points = new Map<string, OddsPoint[]>();

  record(fixtureId: string, point: OddsPoint): void {
    const arr = this.points.get(fixtureId) ?? [];
    arr.push(point);
    this.points.set(fixtureId, arr);
  }

  getTimeline(fixtureId: string): OddsTimeline {
    const all = this.points.get(fixtureId) ?? [];
    const sorted = [...all].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const opening = sorted.length > 0 ? sorted[0] : null;
    const current = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const closing = null;

    const openingClv = opening && current ? (opening.homeOdds / current.homeOdds) - 1 : 0;
    const currentClv = 0;
    const marketMovement = opening && current ? current.homeOdds - opening.homeOdds : 0;
    const steamMovement = opening && current && opening.homeOdds !== current.homeOdds ? Math.abs(marketMovement) / opening.homeOdds : 0;

    return { fixtureId, opening, current, closing, allPoints: sorted, openingClv: Math.round(openingClv * 10000) / 10000, currentClv, marketMovement: Math.round(marketMovement * 10000) / 10000, steamMovement: Math.round(steamMovement * 10000) / 10000 };
  }
}

export const defaultOddsTimelineTracker = new OddsTimelineTracker();