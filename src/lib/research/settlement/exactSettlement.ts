// ============================================================================
// EXACT MULTI-MARKET SETTLEMENT ENGINE
// ============================================================================
// Location: src/lib/research/settlement/exactSettlement.ts
//
// Authoritative deterministic settlement for:
//   1. Asian Handicap: whole, half, quarter lines (WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS)
//   2. Over / Under: whole, half, quarter lines (WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS)
//   3. BTTS: Yes / No (WIN, LOSS)
//   4. Moneyline (1X2): Home / Draw / Away (WIN, LOSS)
//
// Invariants:
//   - Unit Stake = 1.0
//   - P&L and Returns calculated to exact 4-decimal precision
//   - Exact Market Symmetry: Home(L) vs Away(-L)
// ============================================================================

export type SettlementOutcome = 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';

export interface SettlementResult {
  outcome: SettlementOutcome;
  profit: number;       // Net profit (e.g. +0.95, +0.475, 0.0, -0.5, -1.0)
  returnAmount: number; // Gross return (stake + profit)
  stake: number;
}

export class ExactSettlementEngine {
  /**
   * Settles an Asian Handicap bet with exact quarter-line split decomposition.
   */
  public static settleAsianHandicap(
    homeGoals: number,
    awayGoals: number,
    line: number,
    odds: number,
    side: 'HOME' | 'AWAY' = 'HOME',
    stake = 1.0
  ): SettlementResult {
    const selectedGoals = side === 'HOME' ? homeGoals : awayGoals;
    const opponentGoals = side === 'HOME' ? awayGoals : homeGoals;
    const effectiveDiff = (selectedGoals - opponentGoals) + line;
    const eps = 1e-6;

    let outcome: SettlementOutcome;
    let profit: number;

    if (effectiveDiff > 0.25 + eps) {
      // Full Win
      outcome = 'WIN';
      profit = stake * (odds - 1.0);
    } else if (Math.abs(effectiveDiff - 0.25) < eps) {
      // Quarter-ball Half Win
      outcome = 'HALF_WIN';
      profit = (stake / 2.0) * (odds - 1.0);
    } else if (Math.abs(effectiveDiff) < eps) {
      // Whole-ball Push
      outcome = 'PUSH';
      profit = 0.0;
    } else if (Math.abs(effectiveDiff - (-0.25)) < eps) {
      // Quarter-ball Half Loss
      outcome = 'HALF_LOSS';
      profit = -(stake / 2.0);
    } else {
      // Full Loss
      outcome = 'LOSS';
      profit = -stake;
    }

    return {
      outcome,
      profit: Number(profit.toFixed(4)),
      returnAmount: Number((stake + profit).toFixed(4)),
      stake,
    };
  }

  /**
   * Settles an Over/Under bet with whole, half, and quarter totals support.
   */
  public static settleOverUnder(
    totalGoals: number,
    line: number,
    odds: number,
    side: 'OVER' | 'UNDER' = 'OVER',
    stake = 1.0
  ): SettlementResult {
    const isOver = side === 'OVER';
    const frac = Math.round((line - Math.floor(line)) * 100) / 100;
    let outcome: SettlementOutcome;
    let profit: number;

    // 1. Whole line (e.g. 2.0, 3.0)
    if (frac === 0.0) {
      if (totalGoals === line) {
        outcome = 'PUSH';
        profit = 0.0;
      } else if (isOver) {
        if (totalGoals > line) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      } else {
        if (totalGoals < line) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      }
    } else if (frac === 0.5) {
      // 2. Half line (e.g. 2.5, 3.5)
      if (isOver) {
        if (totalGoals > line) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      } else {
        if (totalGoals < line) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      }
    } else if (frac === 0.25) {
      // 3. Quarter line .25 (e.g. 2.25) -> split between whole (line - 0.25) and half (line + 0.25)
      const wholeLine = line - 0.25;
      if (isOver) {
        if (totalGoals >= line + 0.75) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else if (totalGoals === wholeLine) {
          outcome = 'HALF_LOSS';
          profit = -(stake / 2.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      } else {
        if (totalGoals <= line - 1.25) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else if (totalGoals === wholeLine) {
          outcome = 'HALF_WIN';
          profit = (stake / 2.0) * (odds - 1.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      }
    } else if (frac === 0.75) {
      // 4. Quarter line .75 (e.g. 2.75) -> split between half (line - 0.25) and whole (line + 0.25)
      const wholeLine = line + 0.25;
      if (isOver) {
        if (totalGoals >= line + 1.25) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else if (totalGoals === wholeLine) {
          outcome = 'HALF_WIN';
          profit = (stake / 2.0) * (odds - 1.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      } else {
        if (totalGoals <= line - 0.75) {
          outcome = 'WIN';
          profit = stake * (odds - 1.0);
        } else if (totalGoals === wholeLine) {
          outcome = 'HALF_LOSS';
          profit = -(stake / 2.0);
        } else {
          outcome = 'LOSS';
          profit = -stake;
        }
      }
    } else {
      throw new Error(`[ExactSettlement] Unsupported Over/Under line: ${line}`);
    }

    return {
      outcome,
      profit: Number(profit.toFixed(4)),
      returnAmount: Number((stake + profit).toFixed(4)),
      stake,
    };
  }

  /**
   * Settles Both Teams To Score (BTTS).
   */
  public static settleBtts(
    homeGoals: number,
    awayGoals: number,
    odds: number,
    side: 'YES' | 'NO' = 'YES',
    stake = 1.0
  ): SettlementResult {
    const actualBtts = homeGoals > 0 && awayGoals > 0;
    const isWin = (side === 'YES' && actualBtts) || (side === 'NO' && !actualBtts);

    const outcome: SettlementOutcome = isWin ? 'WIN' : 'LOSS';
    const profit = isWin ? stake * (odds - 1.0) : -stake;

    return {
      outcome,
      profit: Number(profit.toFixed(4)),
      returnAmount: Number((stake + profit).toFixed(4)),
      stake,
    };
  }

  /**
   * Settles 1X2 Moneyline.
   */
  public static settleMoneyline(
    homeGoals: number,
    awayGoals: number,
    odds: number,
    selection: 'HOME' | 'DRAW' | 'AWAY',
    stake = 1.0
  ): SettlementResult {
    let actualOutcome: 'HOME' | 'DRAW' | 'AWAY' = 'DRAW';
    if (homeGoals > awayGoals) actualOutcome = 'HOME';
    else if (awayGoals > homeGoals) actualOutcome = 'AWAY';

    const isWin = selection === actualOutcome;
    const outcome: SettlementOutcome = isWin ? 'WIN' : 'LOSS';
    const profit = isWin ? stake * (odds - 1.0) : -stake;

    return {
      outcome,
      profit: Number(profit.toFixed(4)),
      returnAmount: Number((stake + profit).toFixed(4)),
      stake,
    };
  }
}

