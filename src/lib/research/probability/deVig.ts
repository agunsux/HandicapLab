// ============================================================================
// MARKET DE-VIGGING ENGINE
// ============================================================================
// Location: src/lib/research/probability/deVig.ts
//
// Converts raw betting odds into true market-implied probabilities by removing
// bookmaker margin (vig / overround) using market-appropriate methods:
//   1. Two-Way (AH, O/U, BTTS): Multiplicative / Proportional & Power Method
//   2. Three-Way (1X2 Moneyline): Shin Method & Proportional Method
// ============================================================================

export interface TwoWayDeVigResult {
  rawOverround: number; // e.g. 0.045 for 104.5% book
  method: 'PROPORTIONAL' | 'POWER';
  impliedProbA: number;
  impliedProbB: number;
  fairOddsA: number;
  fairOddsB: number;
}

export interface ThreeWayDeVigResult {
  rawOverround: number;
  method: 'SHIN' | 'PROPORTIONAL';
  impliedProbHome: number;
  impliedProbDraw: number;
  impliedProbAway: number;
  fairOddsHome: number;
  fairOddsDraw: number;
  fairOddsAway: number;
  shinZ?: number; // Estimated insider trading fraction z
}

export class DeVigEngine {
  /**
   * De-vigs a standard 2-way market (Asian Handicap, Over/Under, BTTS).
   */
  public static deVigTwoWay(
    oddsA: number,
    oddsB: number,
    method: 'PROPORTIONAL' | 'POWER' = 'PROPORTIONAL'
  ): TwoWayDeVigResult {
    if (oddsA <= 1.0 || oddsB <= 1.0) {
      throw new Error(`[DeVigEngine] Invalid odds: A=${oddsA}, B=${oddsB}`);
    }

    const rawA = 1.0 / oddsA;
    const rawB = 1.0 / oddsB;
    const sumRaw = rawA + rawB;
    const rawOverround = Number((sumRaw - 1.0).toFixed(5));

    if (method === 'PROPORTIONAL') {
      const pA = Number((rawA / sumRaw).toFixed(5));
      const pB = Number((rawB / sumRaw).toFixed(5));
      return {
        rawOverround,
        method: 'PROPORTIONAL',
        impliedProbA: pA,
        impliedProbB: pB,
        fairOddsA: pA > 0 ? Number((1 / pA).toFixed(4)) : Infinity,
        fairOddsB: pB > 0 ? Number((1 / pB).toFixed(4)) : Infinity,
      };
    }

    // Power Method: solve (1/oddsA)^k + (1/oddsB)^k = 1
    let k = 1.0;
    for (let iter = 0; iter < 25; iter++) {
      const f = Math.pow(rawA, k) + Math.pow(rawB, k) - 1.0;
      if (Math.abs(f) < 1e-7) break;
      const df = Math.pow(rawA, k) * Math.log(rawA) + Math.pow(rawB, k) * Math.log(rawB);
      k -= f / df;
    }

    const pA = Number(Math.pow(rawA, k).toFixed(5));
    const pB = Number(Math.pow(rawB, k).toFixed(5));

    return {
      rawOverround,
      method: 'POWER',
      impliedProbA: pA,
      impliedProbB: pB,
      fairOddsA: pA > 0 ? Number((1 / pA).toFixed(4)) : Infinity,
      fairOddsB: pB > 0 ? Number((1 / pB).toFixed(4)) : Infinity,
    };
  }

  /**
   * De-vigs a 3-way market (1X2 Moneyline) using the Shin method or proportional fallback.
   */
  public static deVigThreeWay(
    oddsHome: number,
    oddsDraw: number,
    oddsAway: number,
    preferShin = true
  ): ThreeWayDeVigResult {
    if (oddsHome <= 1.0 || oddsDraw <= 1.0 || oddsAway <= 1.0) {
      throw new Error(
        `[DeVigEngine] Invalid 3-way odds: Home=${oddsHome}, Draw=${oddsDraw}, Away=${oddsAway}`
      );
    }

    const rawH = 1.0 / oddsHome;
    const rawD = 1.0 / oddsDraw;
    const rawA = 1.0 / oddsAway;
    const sumRaw = rawH + rawD + rawA;
    const rawOverround = Number((sumRaw - 1.0).toFixed(5));

    if (!preferShin || sumRaw <= 1.0) {
      // Proportional fallback
      const pH = Number((rawH / sumRaw).toFixed(5));
      const pD = Number((rawD / sumRaw).toFixed(5));
      const pA = Number((rawA / sumRaw).toFixed(5));
      return {
        rawOverround,
        method: 'PROPORTIONAL',
        impliedProbHome: pH,
        impliedProbDraw: pD,
        impliedProbAway: pA,
        fairOddsHome: Number((1 / pH).toFixed(4)),
        fairOddsDraw: Number((1 / pD).toFixed(4)),
        fairOddsAway: Number((1 / pA).toFixed(4)),
      };
    }

    // Shin (1993) Method:
    // Solve for insider proportion z in [0, 0.4]
    // where p_i = (sqrt(z^2 + 4 * (1 - z) * (raw_i^2 / sumRaw)) - z) / (2 * (1 - z))
    let low = 0.0;
    let high = 0.40;
    let bestZ = 0.02;

    for (let iter = 0; iter < 30; iter++) {
      const midZ = (low + high) / 2;
      const computeP = (raw: number) =>
        (Math.sqrt(midZ * midZ + 4 * (1 - midZ) * (raw * raw) / sumRaw) - midZ) /
        (2 * (1 - midZ));

      const sumP = computeP(rawH) + computeP(rawD) + computeP(rawA);
      if (Math.abs(sumP - 1.0) < 1e-6) {
        bestZ = midZ;
        break;
      }
      if (sumP > 1.0) {
        low = midZ;
      } else {
        high = midZ;
      }
      bestZ = midZ;
    }

    const z = bestZ;
    const computeFinalP = (raw: number) =>
      (Math.sqrt(z * z + 4 * (1 - z) * (raw * raw) / sumRaw) - z) /
      (2 * (1 - z));

    const unnormH = computeFinalP(rawH);
    const unnormD = computeFinalP(rawD);
    const unnormA = computeFinalP(rawA);
    const totalP = unnormH + unnormD + unnormA || 1.0;

    const pH = Number((unnormH / totalP).toFixed(5));
    const pD = Number((unnormD / totalP).toFixed(5));
    const pA = Number((unnormA / totalP).toFixed(5));

    return {
      rawOverround,
      method: 'SHIN',
      impliedProbHome: pH,
      impliedProbDraw: pD,
      impliedProbAway: pA,
      fairOddsHome: Number((1 / pH).toFixed(4)),
      fairOddsDraw: Number((1 / pD).toFixed(4)),
      fairOddsAway: Number((1 / pA).toFixed(4)),
      shinZ: Number(z.toFixed(4)),
    };
  }
}

