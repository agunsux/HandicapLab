// Settlement helpers for the walk-forward backtest — mirrors
// src/lib/settlement-core/settlement.ts + python_engine/engine/settlement.py.
// Pure, deterministic, flat 1-unit staking.

export type Outcome = 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';
export type MarketType = 'ML' | 'AH' | 'OU' | 'BTTS';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function outcomeFromMargin(eff: number, odds: number): { outcome: Outcome; profitUnits: number } {
  const e = round2(eff);
  if (e >= 0.5) return { outcome: 'WIN', profitUnits: round4(odds - 1) };
  if (Math.abs(e - 0.25) < 1e-9) return { outcome: 'HALF_WIN', profitUnits: round4(0.5 * (odds - 1)) };
  if (Math.abs(e) < 1e-9) return { outcome: 'PUSH', profitUnits: 0 };
  if (Math.abs(e + 0.25) < 1e-9) return { outcome: 'HALF_LOSS', profitUnits: -0.5 };
  return { outcome: 'LOSS', profitUnits: -1 };
}

export interface SettledBet {
  outcome: Outcome;
  profitUnits: number;
}

export function settleMoneyline(homeGoals: number, awayGoals: number, outcome: 'home' | 'draw' | 'away', odds: number): SettledBet {
  if (odds < 1) return { outcome: 'LOSS', profitUnits: -1 };
  const actual = homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
  if (outcome === actual) return { outcome: 'WIN', profitUnits: round4(odds - 1) };
  return { outcome: 'LOSS', profitUnits: -1 };
}

export function settleAsianHandicap(
  homeGoals: number,
  awayGoals: number,
  line: number,
  selection: 'home' | 'away',
  odds: number
): SettledBet {
  if (odds < 1) return { outcome: 'LOSS', profitUnits: -1 };
  const margin = selection === 'home' ? homeGoals - awayGoals + line : awayGoals - homeGoals - line;
  return outcomeFromMargin(margin, odds);
}

export function settleOverUnder(
  homeGoals: number,
  awayGoals: number,
  line: number,
  selection: 'over' | 'under',
  odds: number
): SettledBet {
  if (odds < 1) return { outcome: 'LOSS', profitUnits: -1 };
  const total = homeGoals + awayGoals;
  const margin = selection === 'over' ? total - line : line - total;
  return outcomeFromMargin(margin, odds);
}

export function settleBtts(
  homeGoals: number,
  awayGoals: number,
  selection: 'btts_yes' | 'btts_no',
  odds: number
): SettledBet {
  if (odds < 1) return { outcome: 'LOSS', profitUnits: -1 };
  const btts = homeGoals > 0 && awayGoals > 0;
  const won = selection === 'btts_yes' ? btts : !btts;
  if (won) return { outcome: 'WIN', profitUnits: round4(odds - 1) };
  return { outcome: 'LOSS', profitUnits: -1 };
}