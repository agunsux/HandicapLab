// ============================================================================
// BTTS VALUE ENGINE v1 — MARKET DE-VIGGING, FAIR ODDS, EDGE & EV ENGINE
// ============================================================================
// Location: src/lib/research/btts/marketEngine.ts
//
// Invariants:
//   - Strict No-Vig Market Probability: normalizes proportional bookmaker margin.
//   - Strict Odds Timing: odds timestamp < kickoff timestamp required.
//   - Mathematical EV: EV = (P * odds) - 1.
//   - Mathematical Edge: Edge = Model Prob - NoVig Market Prob.
//   - Fair Odds: 1 / P.
// ============================================================================

import { BttsMarketOdds } from './types';

export interface MarketComparisonResult {
  market: BttsMarketOdds;
  fairOdds: {
    yes: number;
    no: number;
  };
  edge: {
    yes: number;
    no: number;
  };
  expectedValue: {
    yes: number;
    no: number;
  };
}

export class BttsMarketEngine {
  /**
   * De-vigs two-way BTTS odds and computes no-vig market probabilities.
   */
  public static parseMarketOdds(
    oddsYes: number,
    oddsNo: number,
    closingTimestamp: string,
    kickoffTimestamp: string,
    bookmaker = 'pinnacle',
    openingYes: number | null = null,
    openingNo: number | null = null,
    openingTimestamp: string | null = null
  ): BttsMarketOdds {
    if (oddsYes <= 1.0 || oddsNo <= 1.0) {
      throw new Error(`[BttsMarketEngine] Invalid odds: Yes=${oddsYes}, No=${oddsNo}`);
    }

    const kickoffMs = Date.parse(kickoffTimestamp);
    const closingMs = Date.parse(closingTimestamp);

    const isPreMatch = Number.isFinite(kickoffMs) && Number.isFinite(closingMs) && closingMs < kickoffMs;

    const rawImpliedYes = Number((1.0 / oddsYes).toFixed(5));
    const rawImpliedNo = Number((1.0 / oddsNo).toFixed(5));
    const sumRaw = rawImpliedYes + rawImpliedNo;
    const overround = Number((sumRaw - 1.0).toFixed(5));

    const noVigProbYes = Number((rawImpliedYes / sumRaw).toFixed(5));
    const noVigProbNo = Number((rawImpliedNo / sumRaw).toFixed(5));

    return {
      bookmaker,
      openingYesOdds: openingYes,
      openingNoOdds: openingNo,
      openingTimestamp,
      closingYesOdds: oddsYes,
      closingNoOdds: oddsNo,
      closingTimestamp,
      rawImpliedYes,
      rawImpliedNo,
      overround,
      noVigProbYes,
      noVigProbNo,
      isPreMatch,
    };
  }

  /**
   * Computes fair odds, edge against no-vig market, and mathematical EV.
   */
  public static evaluateMarket(
    modelProbYes: number,
    modelProbNo: number,
    marketOdds: BttsMarketOdds
  ): MarketComparisonResult {
    if (modelProbYes <= 0 || modelProbNo <= 0 || modelProbYes > 1 || modelProbNo > 1) {
      throw new Error(`[BttsMarketEngine] Invalid model probabilities: Yes=${modelProbYes}, No=${modelProbNo}`);
    }

    // 1. Fair Odds = 1 / P
    const fairOddsYes = Number((1.0 / modelProbYes).toFixed(4));
    const fairOddsNo = Number((1.0 / modelProbNo).toFixed(4));

    // 2. Edge = Model Prob - NoVig Market Prob
    const edgeYes = Number((modelProbYes - marketOdds.noVigProbYes).toFixed(5));
    const edgeNo = Number((modelProbNo - marketOdds.noVigProbNo).toFixed(5));

    // 3. Expected Value = (P * odds) - 1
    const evYes = Number((modelProbYes * marketOdds.closingYesOdds - 1.0).toFixed(5));
    const evNo = Number((modelProbNo * marketOdds.closingNoOdds - 1.0).toFixed(5));

    return {
      market: marketOdds,
      fairOdds: {
        yes: fairOddsYes,
        no: fairOddsNo,
      },
      edge: {
        yes: edgeYes,
        no: edgeNo,
      },
      expectedValue: {
        yes: evYes,
        no: evNo,
      },
    };
  }
}
