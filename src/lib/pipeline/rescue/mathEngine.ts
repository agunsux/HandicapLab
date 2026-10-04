// ============================================================================
// SALMO RESCUE PIPELINE — MATHEMATICAL MODELING ENGINE
// Namespace: src/lib/pipeline/rescue/mathEngine.ts
// Model Version: poisson_v1_rescue
// ============================================================================

import { RescueLineType, RescueMarketType } from './types';

export interface PoissonGrid {
  matrix: number[][]; // matrix[h][a]
  lambdaHome: number;
  lambdaAway: number;
  homeWinProb: number; // internal model intermediate only
  drawProb: number;
  awayWinProb: number;
}

export interface AhLineEvaluation {
  line: number;
  lineType: RescueLineType;
  side: 'HOME' | 'AWAY';
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
  pEffectiveWin: number;
  fairOdds: number;
}

export interface OuLineEvaluation {
  line: number;
  lineType: RescueLineType;
  selection: 'OVER' | 'UNDER';
  pFullWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pFullLoss: number;
  pEffectiveWin: number;
  fairOdds: number;
}

export interface BttsEvaluation {
  market: 'BTTS';
  selection: 'BTTS_YES' | 'BTTS_NO';
  modelProbability: number;
  fairOdds: number;
  status: 'RESEARCH_ONLY';
}

export class RescueMathEngine {
  public static readonly SUPPORTED_AH_LINES = [
    -1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5,
  ];

  public static readonly SUPPORTED_OU_LINES = [
    1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0,
  ];

  /**
   * Poisson PMF P(X = k; lambda) = (lambda^k * exp(-lambda)) / k!
   */
  public static poissonPmf(k: number, lambda: number): number {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    let fact = 1;
    for (let i = 2; i <= k; i++) fact *= i;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
  }

  /**
   * Build bivariate score matrix for goals up to 10
   */
  public static buildScoreGrid(lambdaHome: number, lambdaAway: number): PoissonGrid {
    const lH = Math.max(0.05, Math.min(5.0, lambdaHome));
    const lA = Math.max(0.05, Math.min(5.0, lambdaAway));

    const maxGoals = 10;
    const homeProbs: number[] = [];
    const awayProbs: number[] = [];

    for (let i = 0; i <= maxGoals; i++) {
      homeProbs.push(this.poissonPmf(i, lH));
      awayProbs.push(this.poissonPmf(i, lA));
    }

    const matrix: number[][] = [];
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    let totalP = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      for (let a = 0; a <= maxGoals; a++) {
        const p = homeProbs[h] * awayProbs[a];
        matrix[h][a] = p;
        totalP += p;

        if (h > a) homeWin += p;
        else if (h === a) draw += p;
        else awayWin += p;
      }
    }

    if (totalP > 0 && Math.abs(totalP - 1.0) > 1e-6) {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          matrix[h][a] /= totalP;
        }
      }
      homeWin /= totalP;
      draw /= totalP;
      awayWin /= totalP;
    }

    return {
      matrix,
      lambdaHome: lH,
      lambdaAway: lA,
      homeWinProb: homeWin,
      drawProb: draw,
      awayWinProb: awayWin,
    };
  }

  /**
   * Classify line into FULL, HALF, or QUARTER
   */
  public static classifyLine(line: number): RescueLineType {
    const abs = Math.abs(line);
    const frac = Math.round((abs - Math.floor(abs)) * 100) / 100;
    if (frac === 0.0) return 'FULL';
    if (frac === 0.5) return 'HALF';
    return 'QUARTER';
  }

  /**
   * Evaluates Asian Handicap for a specific line and side
   */
  public static evaluateAsianHandicap(
    grid: PoissonGrid,
    line: number,
    side: 'HOME' | 'AWAY'
  ): AhLineEvaluation {
    const lineType = this.classifyLine(line);
    let pFullWin = 0;
    let pHalfWin = 0;
    let pPush = 0;
    let pHalfLoss = 0;
    let pFullLoss = 0;

    const maxGoals = 10;

    if (lineType === 'FULL' || lineType === 'HALF') {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          const p = grid.matrix[h][a];
          const diff = side === 'HOME' ? h - a : a - h;
          const net = diff + line;

          if (net > 1e-6) {
            pFullWin += p;
          } else if (Math.abs(net) <= 1e-6) {
            pPush += p;
          } else {
            pFullLoss += p;
          }
        }
      }
    } else {
      // QUARTER LINE: 50/50 split across adjacent lines
      const l1 = Math.round((line - 0.25) * 100) / 100;
      const l2 = Math.round((line + 0.25) * 100) / 100;

      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          const p = grid.matrix[h][a];
          const diff = side === 'HOME' ? h - a : a - h;

          const net1 = diff + l1;
          const net2 = diff + l2;

          const out1 = net1 > 1e-6 ? 1 : Math.abs(net1) <= 1e-6 ? 0 : -1;
          const out2 = net2 > 1e-6 ? 1 : Math.abs(net2) <= 1e-6 ? 0 : -1;

          if (out1 === 1 && out2 === 1) {
            pFullWin += p;
          } else if (out1 === -1 && out2 === -1) {
            pFullLoss += p;
          } else if (out1 === 0 && out2 === 0) {
            pPush += p;
          } else if ((out1 === 1 && out2 === 0) || (out1 === 0 && out2 === 1)) {
            pHalfWin += p;
          } else if ((out1 === -1 && out2 === 0) || (out1 === 0 && out2 === -1)) {
            pHalfLoss += p;
          } else {
            pPush += p;
          }
        }
      }
    }

    const winNumerator = pFullWin + 0.5 * pHalfWin;
    const lossDenominator = pFullLoss + 0.5 * pHalfLoss;
    const totalDecisive = winNumerator + lossDenominator;
    const pEffectiveWin = totalDecisive > 0 ? winNumerator / totalDecisive : 0.5;
    const fairOdds = pEffectiveWin > 0 ? Number((1 / pEffectiveWin).toFixed(3)) : 2.0;

    return {
      line,
      lineType,
      side,
      pFullWin: Number(pFullWin.toFixed(4)),
      pHalfWin: Number(pHalfWin.toFixed(4)),
      pPush: Number(pPush.toFixed(4)),
      pHalfLoss: Number(pHalfLoss.toFixed(4)),
      pFullLoss: Number(pFullLoss.toFixed(4)),
      pEffectiveWin: Number(pEffectiveWin.toFixed(4)),
      fairOdds,
    };
  }

  /**
   * Evaluates Over/Under for a specific line and selection
   */
  public static evaluateOverUnder(
    grid: PoissonGrid,
    line: number,
    selection: 'OVER' | 'UNDER'
  ): OuLineEvaluation {
    const lineType = this.classifyLine(line);
    let pFullWin = 0;
    let pHalfWin = 0;
    let pPush = 0;
    let pHalfLoss = 0;
    let pFullLoss = 0;

    const maxGoals = 10;

    if (lineType === 'FULL' || lineType === 'HALF') {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          const p = grid.matrix[h][a];
          const total = h + a;
          const net = selection === 'OVER' ? total - line : line - total;

          if (net > 1e-6) {
            pFullWin += p;
          } else if (Math.abs(net) <= 1e-6) {
            pPush += p;
          } else {
            pFullLoss += p;
          }
        }
      }
    } else {
      // QUARTER LINE: 50/50 split across adjacent lines
      const l1 = Math.round((line - 0.25) * 100) / 100;
      const l2 = Math.round((line + 0.25) * 100) / 100;

      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          const p = grid.matrix[h][a];
          const total = h + a;

          const net1 = selection === 'OVER' ? total - l1 : l1 - total;
          const net2 = selection === 'OVER' ? total - l2 : l2 - total;

          const out1 = net1 > 1e-6 ? 1 : Math.abs(net1) <= 1e-6 ? 0 : -1;
          const out2 = net2 > 1e-6 ? 1 : Math.abs(net2) <= 1e-6 ? 0 : -1;

          if (out1 === 1 && out2 === 1) {
            pFullWin += p;
          } else if (out1 === -1 && out2 === -1) {
            pFullLoss += p;
          } else if (out1 === 0 && out2 === 0) {
            pPush += p;
          } else if ((out1 === 1 && out2 === 0) || (out1 === 0 && out2 === 1)) {
            pHalfWin += p;
          } else if ((out1 === -1 && out2 === 0) || (out1 === 0 && out2 === -1)) {
            pHalfLoss += p;
          } else {
            pPush += p;
          }
        }
      }
    }

    const winNumerator = pFullWin + 0.5 * pHalfWin;
    const lossDenominator = pFullLoss + 0.5 * pHalfLoss;
    const totalDecisive = winNumerator + lossDenominator;
    const pEffectiveWin = totalDecisive > 0 ? winNumerator / totalDecisive : 0.5;
    const fairOdds = pEffectiveWin > 0 ? Number((1 / pEffectiveWin).toFixed(3)) : 2.0;

    return {
      line,
      lineType,
      selection,
      pFullWin: Number(pFullWin.toFixed(4)),
      pHalfWin: Number(pHalfWin.toFixed(4)),
      pPush: Number(pPush.toFixed(4)),
      pHalfLoss: Number(pHalfLoss.toFixed(4)),
      pFullLoss: Number(pFullLoss.toFixed(4)),
      pEffectiveWin: Number(pEffectiveWin.toFixed(4)),
      fairOdds,
    };
  }

  /**
   * Evaluates BTTS (Both Teams to Score) — strictly RESEARCH_ONLY
   */
  public static evaluateBtts(grid: PoissonGrid): { yes: BttsEvaluation; no: BttsEvaluation } {
    let bttsYes = 0;
    const maxGoals = 10;

    for (let h = 1; h <= maxGoals; h++) {
      for (let a = 1; a <= maxGoals; a++) {
        bttsYes += grid.matrix[h][a];
      }
    }

    const pYes = Number(bttsYes.toFixed(4));
    const pNo = Number((1.0 - pYes).toFixed(4));

    return {
      yes: {
        market: 'BTTS',
        selection: 'BTTS_YES',
        modelProbability: pYes,
        fairOdds: pYes > 0 ? Number((1 / pYes).toFixed(3)) : 999,
        status: 'RESEARCH_ONLY',
      },
      no: {
        market: 'BTTS',
        selection: 'BTTS_NO',
        modelProbability: pNo,
        fairOdds: pNo > 0 ? Number((1 / pNo).toFixed(3)) : 999,
        status: 'RESEARCH_ONLY',
      },
    };
  }

  /**
   * Payoff-weighted Expected Value (EV) calculation for taken odds
   */
  public static calculateEv(
    pFullWin: number,
    pHalfWin: number,
    pHalfLoss: number,
    pFullLoss: number,
    odds: number
  ): number {
    if (odds <= 1.0) return -1.0;
    const profitFull = odds - 1.0;
    const profitHalf = (odds - 1.0) / 2.0;

    const ev =
      pFullWin * profitFull +
      pHalfWin * profitHalf -
      pHalfLoss * 0.5 -
      pFullLoss * 1.0;

    return Number(ev.toFixed(4));
  }
}
