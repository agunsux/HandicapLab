// ============================================================================
// PRICE-AWARE EXPECTED VALUE (EV) CALCULATOR
// ============================================================================
// Location: src/lib/research/settlement/evCalculator.ts
//
// Calculates true expected value using the EXACT price available at the prediction
// timestamp. Never uses closing odds to compute prediction EV.
//
// Formulas:
//   Binary / 1X2 / BTTS:
//     EV = P(win) * (odds - 1) - P(loss) * 1.0
//
//   Asian Handicap & Over/Under (quarter/whole line decomposition):
//     EV = P(win) * (odds - 1) + P(halfWin) * ((odds - 1) / 2) + P(push) * 0
//          - P(halfLoss) * 0.5 - P(loss) * 1.0
// ============================================================================

export interface ExpectedValueResult {
  predictionTimeOdds: number;
  expectedValue: number;      // in units per 1 unit stake
  edge: number;               // decimal EV / stake
  fairOdds: number;
  isPositiveEv: boolean;
}

export class ExpectedValueCalculator {
  /**
   * Computes exact Expected Value for Asian Handicap or Over/Under quarter/whole lines.
   */
  public static computeQuarterLineEv(
    pWin: number,
    pHalfWin: number,
    pPush: number,
    pHalfLoss: number,
    pLoss: number,
    predictionTimeOdds: number
  ): ExpectedValueResult {
    if (predictionTimeOdds <= 1.0) {
      throw new Error(`[EvCalculator] Invalid predictionTimeOdds: ${predictionTimeOdds}`);
    }

    const netWin = predictionTimeOdds - 1.0;
    const netHalfWin = netWin / 2.0;
    const netHalfLoss = -0.5;
    const netLoss = -1.0;

    const ev =
      pWin * netWin +
      pHalfWin * netHalfWin +
      pPush * 0.0 +
      pHalfLoss * netHalfLoss +
      pLoss * netLoss;

    const pCover = pWin + 0.5 * pHalfWin;
    const fairOdds = pCover > 0 ? Number((1.0 / pCover).toFixed(4)) : Infinity;

    return {
      predictionTimeOdds,
      expectedValue: Number(ev.toFixed(5)),
      edge: Number(ev.toFixed(5)),
      fairOdds,
      isPositiveEv: ev > 0.0,
    };
  }

  /**
   * Computes standard binary Expected Value (1X2, BTTS, simple Over/Under half lines).
   */
  public static computeBinaryEv(
    winProbability: number,
    predictionTimeOdds: number
  ): ExpectedValueResult {
    if (predictionTimeOdds <= 1.0) {
      throw new Error(`[EvCalculator] Invalid predictionTimeOdds: ${predictionTimeOdds}`);
    }

    const pWin = Math.max(0.0, Math.min(1.0, winProbability));
    const pLoss = 1.0 - pWin;

    const ev = pWin * (predictionTimeOdds - 1.0) - pLoss * 1.0;
    const fairOdds = pWin > 0 ? Number((1.0 / pWin).toFixed(4)) : Infinity;

    return {
      predictionTimeOdds,
      expectedValue: Number(ev.toFixed(5)),
      edge: Number(ev.toFixed(5)),
      fairOdds,
      isPositiveEv: ev > 0.0,
    };
  }
}

