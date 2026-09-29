// ============================================================================
// OVER/UNDER PROBABILITY & SETTLEMENT ENGINE
// ============================================================================
// Location: src/lib/research/ou/ouProbabilityEngine.ts
//
// Authoritative engine for the Football Goals Over/Under Line Family:
//   - Full lines: 1.0, 2.0, 3.0, 4.0 (supports Push)
//   - Half lines: 0.5, 1.5, 2.5, 3.5, 4.5 (binary settlement)
//   - Quarter lines: 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75 (50/50 split)
//
// Invariants enforced:
//   1. Probability mass conservation: sum(TotalGoals PMF) = 1.0 +- 1e-6
//   2. Line-specific settlement: pFullWin + pHalfWin + pPush + pHalfLoss + pFullLoss = 1.0
//   3. Settlement-aware fair odds: E[Profit](O_fair) = 0 <=> O_fair = 1 / pEff
//   4. Strict Over/Under complementarity: pEff(Over) + pEff(Under) = 1.0
//   5. Strict monotonicity across line ladder
// ============================================================================

export type OuLineType = 'FULL' | 'HALF' | 'QUARTER';
export type OuSelection = 'OVER' | 'UNDER';

export interface TotalGoalsPmf {
  pmf: number[];             // pmf[n] = P(TotalGoals = n), for n = 0..maxGoals
  expectedGoals: number;     // E[G] = sum(n * pmf[n])
  maxTotal: number;
}

export interface OuLineSettlementProbabilities {
  line: number;
  selection: OuSelection;
  lineType: OuLineType;
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
  pEffectiveWin: number;     // pEff = (pFullWin + 0.5 * pHalfWin) / ((pFullWin + 0.5 * pHalfWin) + (pFullLoss + 0.5 * pHalfLoss))
  fairOdds: number;          // 1 / pEffectiveWin
}

export interface OuEvResult {
  odds: number;
  expectedValue: number;     // EV in units per 1 unit stake
  edge: number;              // pEff - pImplied
  fairOdds: number;
  pEffectiveWin: number;
}

export class OuProbabilityEngine {
  /**
   * Classify an Over/Under line into FULL, HALF, or QUARTER.
   */
  public static classifyOuLine(line: number): OuLineType {
    if (!Number.isFinite(line) || line < 0) {
      throw new Error(`[OuProbabilityEngine] Invalid line: ${line}`);
    }
    const frac = Math.round((line - Math.floor(line)) * 100) / 100;
    if (frac === 0.0) return 'FULL';
    if (frac === 0.5) return 'HALF';
    if (frac === 0.25 || frac === 0.75) return 'QUARTER';
    throw new Error(`[OuProbabilityEngine] Unsupported line fraction ${frac} for line ${line}`);
  }

  /**
   * Split a quarter line into its two adjacent lower (L1) and upper (L2) lines.
   * For example:
   *   2.25 -> [2.00, 2.50]
   *   2.75 -> [2.50, 3.00]
   *   3.25 -> [3.00, 3.50]
   */
  public static getQuarterComponents(line: number): [number, number] {
    const l1 = Number((line - 0.25).toFixed(2));
    const l2 = Number((line + 0.25).toFixed(2));
    return [l1, l2];
  }

  /**
   * Derives Total Goals 1D PMF from a bivariate score matrix P(h, a).
   */
  public static computeTotalGoalsPmf(grid: number[][]): TotalGoalsPmf {
    const maxHome = grid.length - 1;
    const maxAway = (grid[0]?.length ?? 1) - 1;
    const maxTotal = maxHome + maxAway;

    const pmf = new Array<number>(maxTotal + 1).fill(0);
    let totalSum = 0;
    let expectedGoals = 0;

    for (let h = 0; h <= maxHome; h++) {
      for (let a = 0; a <= maxAway; a++) {
        const p = grid[h][a] ?? 0;
        if (p > 0) {
          pmf[h + a] += p;
          totalSum += p;
        }
      }
    }

    // Normalize to conserve probability mass
    if (totalSum > 0 && Math.abs(totalSum - 1.0) > 1e-12) {
      for (let t = 0; t <= maxTotal; t++) {
        pmf[t] /= totalSum;
      }
    }

    for (let t = 0; t <= maxTotal; t++) {
      expectedGoals += t * pmf[t];
    }

    return {
      pmf,
      expectedGoals: Number(expectedGoals.toFixed(4)),
      maxTotal,
    };
  }

  /**
   * Derives exact line-specific settlement probabilities for any supported line.
   */
  public static deriveOuSettlementProbabilities(
    totalPmf: TotalGoalsPmf | number[],
    line: number,
    selection: OuSelection
  ): OuLineSettlementProbabilities {
    const pmfArray = Array.isArray(totalPmf) ? totalPmf : totalPmf.pmf;
    const maxTotal = pmfArray.length - 1;
    const lineType = this.classifyOuLine(line);
    const isOver = selection === 'OVER';

    let pFullWin = 0;
    let pHalfWin = 0;
    let pPush = 0;
    let pHalfLoss = 0;
    let pFullLoss = 0;

    if (lineType === 'FULL') {
      // Whole lines (e.g. 1.0, 2.0, 3.0, 4.0)
      for (let t = 0; t <= maxTotal; t++) {
        const p = pmfArray[t];
        if (p <= 0) continue;

        if (t === line) {
          pPush += p;
        } else if (isOver) {
          if (t > line) pFullWin += p;
          else pFullLoss += p;
        } else {
          // UNDER
          if (t < line) pFullWin += p;
          else pFullLoss += p;
        }
      }
    } else if (lineType === 'HALF') {
      // Half lines (e.g. 0.5, 1.5, 2.5, 3.5, 4.5)
      for (let t = 0; t <= maxTotal; t++) {
        const p = pmfArray[t];
        if (p <= 0) continue;

        if (isOver) {
          if (t > line) pFullWin += p;
          else pFullLoss += p;
        } else {
          // UNDER
          if (t < line) pFullWin += p;
          else pFullLoss += p;
        }
      }
    } else {
      // QUARTER lines (e.g. 1.25, 1.75, 2.25, 2.75, 3.25, 3.75)
      // Quarter line decomposes into equal 50/50 split across L1 = line - 0.25 and L2 = line + 0.25
      const [l1, l2] = this.getQuarterComponents(line);

      for (let t = 0; t <= maxTotal; t++) {
        const p = pmfArray[t];
        if (p <= 0) continue;

        let w1 = 0; // Outcome on line L1 (+1 = win, 0 = push, -1 = loss)
        let w2 = 0; // Outcome on line L2 (+1 = win, 0 = push, -1 = loss)

        if (isOver) {
          w1 = t > l1 ? 1 : t === l1 ? 0 : -1;
          w2 = t > l2 ? 1 : t === l2 ? 0 : -1;
        } else {
          // UNDER
          w1 = t < l1 ? 1 : t === l1 ? 0 : -1;
          w2 = t < l2 ? 1 : t === l2 ? 0 : -1;
        }

        if (w1 === 1 && w2 === 1) {
          pFullWin += p;
        } else if (w1 === -1 && w2 === -1) {
          pFullLoss += p;
        } else if (w1 === 0 && w2 === 0) {
          pPush += p;
        } else if ((w1 === 1 && w2 === 0) || (w1 === 0 && w2 === 1)) {
          pHalfWin += p;
        } else if ((w1 === -1 && w2 === 0) || (w1 === 0 && w2 === -1)) {
          pHalfLoss += p;
        } else {
          pPush += p;
        }
      }
    }

    // Effective Win Probability pEff:
    // Solves E[profit](fairOdds) = 0 where fairOdds = 1 / pEff:
    // (pFullWin + 0.5 * pHalfWin) * (O - 1) - (pFullLoss + 0.5 * pHalfLoss) = 0
    const winNumerator = pFullWin + 0.5 * pHalfWin;
    const lossDenominator = pFullLoss + 0.5 * pHalfLoss;
    const totalDecisive = winNumerator + lossDenominator;

    const pEffectiveWin = totalDecisive > 0 ? winNumerator / totalDecisive : 0.5;
    const fairOdds = pEffectiveWin > 0 ? 1 / pEffectiveWin : 999.0;

    return {
      line,
      selection,
      lineType,
      pFullWin: Number(pFullWin.toFixed(6)),
      pHalfWin: Number(pHalfWin.toFixed(6)),
      pPush: Number(pPush.toFixed(6)),
      pHalfLoss: Number(pHalfLoss.toFixed(6)),
      pFullLoss: Number(pFullLoss.toFixed(6)),
      pEffectiveWin: Number(pEffectiveWin.toFixed(6)),
      fairOdds: Number(Math.max(1.01, Math.min(100.0, fairOdds)).toFixed(4)),
    };
  }

  /**
   * Computes exact Expected Value (EV) for an Over/Under bet given market odds.
   * Payoff structure:
   *   FULL WIN:  O - 1
   *   HALF WIN:  (O - 1) / 2
   *   PUSH:      0
   *   HALF LOSS: -0.5
   *   FULL LOSS: -1.0
   */
  public static computeOuEv(probs: OuLineSettlementProbabilities, marketOdds: number): number {
    if (marketOdds <= 1.0) {
      throw new Error(`[OuProbabilityEngine] Invalid market odds: ${marketOdds}`);
    }

    const netWin = marketOdds - 1.0;
    const netHalfWin = netWin / 2.0;
    const netHalfLoss = -0.5;
    const netLoss = -1.0;

    const ev =
      probs.pFullWin * netWin +
      probs.pHalfWin * netHalfWin +
      probs.pPush * 0.0 +
      probs.pHalfLoss * netHalfLoss +
      probs.pFullLoss * netLoss;

    return Number(ev.toFixed(6));
  }

  /**
   * De-vigs a 2-way Over/Under market using proportional normalization.
   */
  public static devig2WayOu(
    overOdds: number,
    underOdds: number
  ): { overImplied: number; underImplied: number; vigMargin: number } {
    if (overOdds <= 1.0 || underOdds <= 1.0) {
      throw new Error(`[OuProbabilityEngine] Invalid odds: over=${overOdds}, under=${underOdds}`);
    }

    const invOver = 1.0 / overOdds;
    const invUnder = 1.0 / underOdds;
    const sumInv = invOver + invUnder;

    return {
      overImplied: Number((invOver / sumInv).toFixed(6)),
      underImplied: Number((invUnder / sumInv).toFixed(6)),
      vigMargin: Number((sumInv - 1.0).toFixed(6)),
    };
  }
}
