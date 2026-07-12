/**
 * 21.5 — Match Result Collector
 * After fixture completion, collects score and result artifact.
 */

import type { MatchResult } from './types';
import { generateResultId } from './id';

export class ResultCollector {
  collect(input: {
    fixtureId: string; homeGoals: number; awayGoals: number;
    corners?: number[]; cards?: number[]; xg?: number[] | null;
    status?: string;
  }): MatchResult {
    const { homeGoals, awayGoals } = input;
    const winner: 'home' | 'away' | 'draw' | null = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : homeGoals === awayGoals ? 'draw' : null;
    const ahResult = homeGoals - awayGoals;
    const ouResult = homeGoals + awayGoals;
    const btts = homeGoals > 0 && awayGoals > 0;

    return Object.freeze({
      resultId: generateResultId(),
      fixtureId: input.fixtureId,
      homeGoals, awayGoals, winner, ahResult: ahResult >= 0 ? `H${ahResult}` : `A${Math.abs(ahResult)}`, ouResult: ouResult >= 2.5 ? 'over' : 'under', btts,
      corners: input.corners ?? [0, 0],
      cards: input.cards ?? [0, 0],
      xg: input.xg ?? null,
      status: input.status ?? 'finished',
      collectedAt: new Date().toISOString(),
    });
  }
}

export const defaultResultCollector = new ResultCollector();