// EPIC 56 — Asian Handicap Settlement Truth Engine
// Location: src/lib/research/ah-solo/ahSettlementEngine.ts

import { SettlementOutcome, AhSide } from './ahTypes';

export interface SettlementDetail {
  outcome: SettlementOutcome;
  diff: number; // goal difference from perspective of selected side
  line: number;
  isQuarterLine: boolean;
  componentLines?: [number, number];
  componentOutcomes?: [SettlementOutcome, SettlementOutcome];
  profit: number; // net profit in units
  payoffMultiplier: number; // net profit multiplier: e.g. +1.0 for even-money win, -0.5 for half loss
  isVoid: boolean;
}

export function isQuarterLine(line: number): boolean {
  const abs = Math.abs(line);
  const frac = Math.round((abs - Math.floor(abs)) * 100) / 100;
  return frac === 0.25 || frac === 0.75;
}

export function getQuarterComponents(line: number): [number, number] {
  const l1 = Math.round((line - 0.25) * 100) / 100;
  const l2 = Math.round((line + 0.25) * 100) / 100;
  return [l1, l2];
}

function settleSingleStep(margin: number): SettlementOutcome {
  if (margin > 1e-6) return 'FULL_WIN';
  if (margin < -1e-6) return 'FULL_LOSS';
  return 'PUSH';
}

function combineQuarterOutcomes(r1: SettlementOutcome, r2: SettlementOutcome): SettlementOutcome {
  if (r1 === 'VOID' || r2 === 'VOID') return 'VOID';
  if (r1 === 'FULL_WIN' && r2 === 'FULL_WIN') return 'FULL_WIN';
  if (r1 === 'FULL_LOSS' && r2 === 'FULL_LOSS') return 'FULL_LOSS';
  if (r1 === 'PUSH' && r2 === 'PUSH') return 'PUSH';
  
  if ((r1 === 'FULL_WIN' && r2 === 'PUSH') || (r1 === 'PUSH' && r2 === 'FULL_WIN')) {
    return 'HALF_WIN';
  }
  if ((r1 === 'FULL_LOSS' && r2 === 'PUSH') || (r1 === 'PUSH' && r2 === 'FULL_LOSS')) {
    return 'HALF_LOSS';
  }

  // Fallback (e.g. WIN + LOSS -> PUSH)
  return 'PUSH';
}

/**
 * Calculates settlement outcome and exact profit for any Asian Handicap bet.
 * @param side 'home' or 'away'
 * @param line handicap line for the selected side (e.g. -0.75, +0.25, 0.0)
 * @param homeGoals actual home goals
 * @param awayGoals actual away goals
 * @param decimalOdds taken decimal odds (e.g. 1.95)
 * @param stake stake amount (default 1.0)
 * @param isVoid optional flag if match was postponed/abandoned
 */
export function settleAsianHandicap(
  side: AhSide,
  line: number,
  homeGoals: number,
  awayGoals: number,
  decimalOdds: number,
  stake = 1.0,
  isVoid = false
): SettlementDetail {
  if (isVoid || homeGoals < 0 || awayGoals < 0 || isNaN(homeGoals) || isNaN(awayGoals)) {
    return {
      outcome: 'VOID',
      diff: 0,
      line,
      isQuarterLine: isQuarterLine(line),
      profit: 0,
      payoffMultiplier: 0,
      isVoid: true,
    };
  }

  const diff = side === 'home' ? homeGoals - awayGoals : awayGoals - homeGoals;
  const quarter = isQuarterLine(line);

  let outcome: SettlementOutcome;
  let componentLines: [number, number] | undefined;
  let componentOutcomes: [SettlementOutcome, SettlementOutcome] | undefined;

  if (quarter) {
    const [l1, l2] = getQuarterComponents(line);
    componentLines = [l1, l2];
    const r1 = settleSingleStep(diff + l1);
    const r2 = settleSingleStep(diff + l2);
    componentOutcomes = [r1, r2];
    outcome = combineQuarterOutcomes(r1, r2);
  } else {
    outcome = settleSingleStep(diff + line);
  }

  let profit = 0;
  let payoffMultiplier = 0;

  switch (outcome) {
    case 'FULL_WIN':
      profit = (decimalOdds - 1.0) * stake;
      payoffMultiplier = decimalOdds - 1.0;
      break;
    case 'HALF_WIN':
      profit = ((decimalOdds - 1.0) / 2.0) * stake;
      payoffMultiplier = (decimalOdds - 1.0) / 2.0;
      break;
    case 'PUSH':
      profit = 0;
      payoffMultiplier = 0;
      break;
    case 'HALF_LOSS':
      profit = -0.5 * stake;
      payoffMultiplier = -0.5;
      break;
    case 'FULL_LOSS':
      profit = -1.0 * stake;
      payoffMultiplier = -1.0;
      break;
    case 'VOID':
      profit = 0;
      payoffMultiplier = 0;
      break;
  }

  return {
    outcome,
    diff,
    line,
    isQuarterLine: quarter,
    componentLines,
    componentOutcomes,
    profit: Number(profit.toFixed(6)),
    payoffMultiplier: Number(payoffMultiplier.toFixed(6)),
    isVoid: false,
  };
}
