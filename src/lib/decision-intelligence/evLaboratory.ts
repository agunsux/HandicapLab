/**
 * EPIC 20.3 — Expected Value Laboratory
 */

import type { EVResult } from './types';
import { generateEVId } from './id';

export class EVLaboratory {
  compute(input: {
    fixtureId: string;
    market: string;
    rawProbability: number;
    calibratedProbability: number;
    homeOdds: number;
    drawOdds: number | null;
    awayOdds: number;
  }): EVResult {
    const prob = input.calibratedProbability;
    const odds = input.homeOdds;
    const drawOdds = input.drawOdds;
    const awayOdds = input.awayOdds;

    const expectedValue = (prob * odds) - 1;
    const expectedReturn = prob * odds;
    const riskAdjustedEv = expectedValue / (Math.max(odds, 1) - 1);
    const probabilityEdge = prob - (1 / odds);
    const marketEdge = (1 / odds) - prob;
    const fairOdds = 1 / prob;
    const valueMargin = expectedValue * 100;
    const noBetMargin = 0;
    const breakEvenProbability = 1 / odds;

    return {
      fixtureId: input.fixtureId,
      market: input.market,
      rawProbability: input.rawProbability,
      calibratedProbability: input.calibratedProbability,
      homeOdds: input.homeOdds,
      drawOdds: input.drawOdds,
      awayOdds: input.awayOdds,
      expectedValue: Math.round(expectedValue * 10000) / 10000,
      expectedReturn: Math.round(expectedReturn * 10000) / 10000,
      riskAdjustedEv: Math.round(riskAdjustedEv * 10000) / 10000,
      probabilityEdge: Math.round(probabilityEdge * 10000) / 10000,
      marketEdge: Math.round(marketEdge * 10000) / 10000,
      fairOdds: Math.round(fairOdds * 100) / 100,
      valueMargin: Math.round(valueMargin * 100) / 100,
      noBetMargin,
      breakEvenProbability: Math.round(breakEvenProbability * 10000) / 10000,
    };
  }
}

export const defaultEVLaboratory = new EVLaboratory();