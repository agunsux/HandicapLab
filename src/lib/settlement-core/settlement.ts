// ============================================================================
// SETTLEMENT ENGINE  (Epic 31A — Section D)
// ============================================================================
// Pure, deterministic settlement for Moneyline, Asian Handicap (incl. quarter
// and half lines) and Over/Under. On a 1-unit stake basis.
//
// Outcomes: WIN, HALF_WIN, PUSH, HALF_LOSS, LOSS, VOID.
// VOID returns 0 units (stake returned) — used for cancelled / postponed /
// abandoned matches.
//
// Asian Handicap & Over/Under share the same "effective margin" logic:
//   effectiveMargin = goalDifferential(or total) + line
//   >= 0.5  -> WIN            (full stake wins: odds - 1)
//   == 0.25 -> HALF_WIN       (half wins:  0.5 * (odds - 1))
//   == 0    -> PUSH           (stake returned: 0)   [whole-number lines only]
//   ==-0.25 -> HALF_LOSS      (half loses: -0.5)
//   <  -0.25 -> LOSS          (full stake loses: -1)
// Floating point is neutralised by rounding to 2dp before comparison, since
// every effective margin is an exact multiple of 0.25.
// ============================================================================

import type {
  MarketType,
  Selection,
  SettlementInput,
  SettlementOutcome,
  SettlementResult,
} from './types';

const EPS = 1e-9;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function outcomeFromMargin(eff: number, odds: number): SettlementResult {
  const e = round2(eff);
  if (e >= 0.5) return { outcome: 'WIN', profitUnits: round4(odds - 1) };
  if (Math.abs(e - 0.25) < EPS) return { outcome: 'HALF_WIN', profitUnits: round4(0.5 * (odds - 1)) };
  if (Math.abs(e) < EPS) return { outcome: 'PUSH', profitUnits: 0 };
  if (Math.abs(e + 0.25) < EPS) return { outcome: 'HALF_LOSS', profitUnits: -0.5 };
  return { outcome: 'LOSS', profitUnits: -1 };
}

function effectiveMargin(
  homeGoals: number,
  awayGoals: number,
  line: number,
  selection: Selection
): number {
  if (selection === 'home') return homeGoals - awayGoals + line;
  if (selection === 'away') return awayGoals - homeGoals - line;
  if (selection === 'over') return homeGoals + awayGoals - line;
  // under
  return line - (homeGoals + awayGoals);
}

export function settleMoneyline(
  homeGoals: number,
  awayGoals: number,
  selection: 'home' | 'draw' | 'away',
  odds: number,
  voided = false
): SettlementResult {
  if (voided) return { outcome: 'VOID', profitUnits: 0 };
  if (homeGoals < 0 || awayGoals < 0 || odds < 1) return { outcome: 'VOID', profitUnits: 0 };

  const actual: 'home' | 'draw' | 'away' =
    homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
  const won = selection === actual;
  return {
    outcome: won ? 'WIN' : 'LOSS',
    profitUnits: won ? round4(odds - 1) : -1,
  };
}

export function settleAsianHandicap(
  homeGoals: number,
  awayGoals: number,
  line: number,
  selection: 'home' | 'away',
  odds: number,
  voided = false
): SettlementResult {
  if (voided) return { outcome: 'VOID', profitUnits: 0 };
  if (homeGoals < 0 || awayGoals < 0 || odds < 1) return { outcome: 'VOID', profitUnits: 0 };
  return outcomeFromMargin(effectiveMargin(homeGoals, awayGoals, line, selection), odds);
}

export function settleOverUnder(
  homeGoals: number,
  awayGoals: number,
  line: number,
  selection: 'over' | 'under',
  odds: number,
  voided = false
): SettlementResult {
  if (voided) return { outcome: 'VOID', profitUnits: 0 };
  if (homeGoals < 0 || awayGoals < 0 || odds < 1) return { outcome: 'VOID', profitUnits: 0 };
  return outcomeFromMargin(effectiveMargin(homeGoals, awayGoals, line, selection), odds);
}

export function settle(input: SettlementInput, market: MarketType): SettlementResult {
  const { homeGoals, awayGoals, line, selection, odds, voided } = input;
  switch (market) {
    case 'moneyline':
      return settleMoneyline(homeGoals, awayGoals, selection as 'home' | 'draw' | 'away', odds, voided);
    case 'asian_handicap':
      return settleAsianHandicap(homeGoals, awayGoals, line, selection as 'home' | 'away', odds, voided);
    case 'over_under':
      return settleOverUnder(homeGoals, awayGoals, line, selection as 'over' | 'under', odds, voided);
  }
}

export { round2 };