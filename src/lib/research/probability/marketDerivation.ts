// ============================================================================
// MARKET DERIVATION ENGINE
// ============================================================================
// Location: src/lib/research/probability/marketDerivation.ts
//
// Mathematically derives all betting markets from a unified bivariate score grid:
//   1. Moneyline (1X2)
//   2. Asian Handicap (whole, half, quarter lines)
//   3. Over / Under (whole, half, quarter lines)
//   4. Both Teams To Score (BTTS Yes / No)
//
// Invariants:
//   - Zero Discrepancy: P(Home) + P(Draw) + P(Away) == 1.0
//   - Exact AH Symmetry: Home(L) vs Away(-L)
//   - Zero Approximations: exact quarter-ball settlement convolution
// ============================================================================

import {
  BivariateScoreDistribution,
  MoneylineProbabilities,
  AsianHandicapProbabilities,
  OverUnderProbabilities,
  BttsProbabilities,
  DerivedMarketsResult,
} from './types';

export class MarketDerivationEngine {
  /**
   * Derives 1X2 Moneyline outcome probabilities.
   */
  public static deriveMoneyline(dist: BivariateScoreDistribution): MoneylineProbabilities {
    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;

    for (let h = 0; h <= dist.maxGoals; h++) {
      for (let a = 0; a <= dist.maxGoals; a++) {
        const p = dist.matrix[h][a];
        if (h > a) pHome += p;
        else if (h === a) pDraw += p;
        else pAway += p;
      }
    }

    const total = pHome + pDraw + pAway || 1.0;
    const normH = Number((pHome / total).toFixed(5));
    const normD = Number((pDraw / total).toFixed(5));
    const normA = Number((pAway / total).toFixed(5));

    return {
      pHome: normH,
      pDraw: normD,
      pAway: normA,
      fairOddsHome: normH > 0 ? Number((1 / normH).toFixed(4)) : Infinity,
      fairOddsDraw: normD > 0 ? Number((1 / normD).toFixed(4)) : Infinity,
      fairOddsAway: normA > 0 ? Number((1 / normA).toFixed(4)) : Infinity,
    };
  }

  /**
   * Derives exact settlement probabilities for any Asian Handicap line.
   * Handles whole, half, and quarter-ball lines.
   */
  public static deriveAsianHandicap(
    dist: BivariateScoreDistribution,
    line: number
  ): AsianHandicapProbabilities {
    const eps = 1e-6;
    let pWin = 0;
    let pHalfWin = 0;
    let pPush = 0;
    let pHalfLoss = 0;
    let pLoss = 0;

    for (let h = 0; h <= dist.maxGoals; h++) {
      for (let a = 0; a <= dist.maxGoals; a++) {
        const p = dist.matrix[h][a];
        const effectiveDiff = (h - a) + line;

        if (effectiveDiff > 0.25 + eps) {
          pWin += p;
        } else if (Math.abs(effectiveDiff - 0.25) < eps) {
          pHalfWin += p;
        } else if (Math.abs(effectiveDiff) < eps) {
          pPush += p;
        } else if (Math.abs(effectiveDiff - (-0.25)) < eps) {
          pHalfLoss += p;
        } else {
          pLoss += p;
        }
      }
    }

    const sum = pWin + pHalfWin + pPush + pHalfLoss + pLoss || 1.0;
    const normWin = Number((pWin / sum).toFixed(5));
    const normHalfWin = Number((pHalfWin / sum).toFixed(5));
    const normPush = Number((pPush / sum).toFixed(5));
    const normHalfLoss = Number((pHalfLoss / sum).toFixed(5));
    const normLoss = Number((pLoss / sum).toFixed(5));

    const pCover = Number((normWin + 0.5 * normHalfWin).toFixed(5));
    const fairOdds = pCover > 0 ? Number((1 / pCover).toFixed(4)) : Infinity;

    return {
      line,
      pWin: normWin,
      pHalfWin: normHalfWin,
      pPush: normPush,
      pHalfLoss: normHalfLoss,
      pLoss: normLoss,
      pCover,
      fairOdds,
    };
  }

  /**
   * Derives Over/Under probabilities for any whole, half, or quarter goal line.
   */
  public static deriveOverUnder(
    dist: BivariateScoreDistribution,
    line: number
  ): OverUnderProbabilities {
    // 1D total goals distribution
    const maxTotal = dist.maxGoals * 2;
    const totalPmf = new Float64Array(maxTotal + 1);

    for (let h = 0; h <= dist.maxGoals; h++) {
      for (let a = 0; a <= dist.maxGoals; a++) {
        totalPmf[h + a] += dist.matrix[h][a];
      }
    }

    const frac = Math.round((line - Math.floor(line)) * 100) / 100;

    let oWin = 0, oHalfWin = 0, oPush = 0, oHalfLoss = 0, oLoss = 0;
    let uWin = 0, uHalfWin = 0, uPush = 0, uHalfLoss = 0, uLoss = 0;

    for (let t = 0; t <= maxTotal; t++) {
      const p = totalPmf[t];
      if (p <= 0) continue;

      if (frac === 0.0) {
        // Whole line (e.g. 2.0, 3.0)
        if (t === line) {
          oPush += p;
          uPush += p;
        } else if (t > line) {
          oWin += p;
          uLoss += p;
        } else {
          oLoss += p;
          uWin += p;
        }
      } else if (frac === 0.5) {
        // Half line (e.g. 2.5, 3.5)
        if (t > line) {
          oWin += p;
          uLoss += p;
        } else {
          oLoss += p;
          uWin += p;
        }
      } else if (frac === 0.25) {
        // Quarter line .25 (e.g. 2.25) -> split between whole (line - 0.25) and half (line + 0.25)
        const wholeLine = line - 0.25;
        if (t >= line + 0.75) {
          oWin += p;
          uLoss += p;
        } else if (t === wholeLine) {
          oHalfLoss += p; // Over: whole pushes, half loses -> half loss
          uHalfWin += p;  // Under: whole pushes, half wins -> half win
        } else {
          oLoss += p;
          uWin += p;
        }
      } else if (frac === 0.75) {
        // Quarter line .75 (e.g. 2.75) -> split between half (line - 0.25) and whole (line + 0.25)
        const wholeLine = line + 0.25;
        if (t >= line + 1.25) {
          oWin += p;
          uLoss += p;
        } else if (t === wholeLine) {
          oHalfWin += p;  // Over: half wins, whole pushes -> half win
          uHalfLoss += p; // Under: half loses, whole pushes -> half loss
        } else {
          oLoss += p;
          uWin += p;
        }
      }
    }

    const normO = (v: number) => Number(v.toFixed(5));
    const pCoverOver = normO(oWin + 0.5 * oHalfWin);
    const pCoverUnder = normO(uWin + 0.5 * uHalfWin);

    return {
      line,
      over: {
        pWin: normO(oWin),
        pHalfWin: normO(oHalfWin),
        pPush: normO(oPush),
        pHalfLoss: normO(oHalfLoss),
        pLoss: normO(oLoss),
        pCover: pCoverOver,
        fairOdds: pCoverOver > 0 ? Number((1 / pCoverOver).toFixed(4)) : Infinity,
      },
      under: {
        pWin: normO(uWin),
        pHalfWin: normO(uHalfWin),
        pPush: normO(uPush),
        pHalfLoss: normO(uHalfLoss),
        pLoss: normO(uLoss),
        pCover: pCoverUnder,
        fairOdds: pCoverUnder > 0 ? Number((1 / pCoverUnder).toFixed(4)) : Infinity,
      },
    };
  }

  /**
   * Derives Both Teams To Score (BTTS) probabilities.
   */
  public static deriveBtts(dist: BivariateScoreDistribution): BttsProbabilities {
    let pYes = 0;

    for (let h = 1; h <= dist.maxGoals; h++) {
      for (let a = 1; a <= dist.maxGoals; a++) {
        pYes += dist.matrix[h][a];
      }
    }

    const normYes = Number(pYes.toFixed(5));
    const normNo = Number((1.0 - normYes).toFixed(5));

    return {
      pYes: normYes,
      pNo: normNo,
      fairOddsYes: normYes > 0 ? Number((1 / normYes).toFixed(4)) : Infinity,
      fairOddsNo: normNo > 0 ? Number((1 / normNo).toFixed(4)) : Infinity,
    };
  }

  /**
   * Derives all core markets from a bivariate score grid.
   */
  public static deriveAll(
    dist: BivariateScoreDistribution,
    ahLines: number[] = [-2.0, -1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
    ouLines: number[] = [1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0]
  ): DerivedMarketsResult {
    const moneyline = this.deriveMoneyline(dist);
    const btts = this.deriveBtts(dist);

    const asianHandicap: Record<number, AsianHandicapProbabilities> = {};
    for (const l of ahLines) {
      asianHandicap[l] = this.deriveAsianHandicap(dist, l);
    }

    const overUnder: Record<number, OverUnderProbabilities> = {};
    for (const l of ouLines) {
      overUnder[l] = this.deriveOverUnder(dist, l);
    }

    return {
      scoreDistribution: dist,
      moneyline,
      asianHandicap,
      overUnder,
      btts,
    };
  }
}

