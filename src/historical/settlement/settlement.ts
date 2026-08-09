export type SettlementOutcome = 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';

export type MlSelection = 'home' | 'draw' | 'away';
export type AhSide = 'home' | 'away';
export type OuSide = 'over' | 'under';
export type BttsSide = 'yes' | 'no';

function settleHalfStep(margin: number): SettlementOutcome {
  if (margin > 0.000001) return 'WIN';
  if (margin < -0.000001) return 'LOSS';
  return 'PUSH';
}

function combineHalf(r1: SettlementOutcome, r2: SettlementOutcome): SettlementOutcome {
  if (r1 === r2) return r1;
  const hasPush = r1 === 'PUSH' || r2 === 'PUSH';
  if (!hasPush) return 'PUSH';
  return (r1 === 'WIN' || r2 === 'WIN') ? 'HALF_WIN' : 'HALF_LOSS';
}

function isQuarterLine(line: number): boolean {
  const frac = Math.abs(line - Math.trunc(line));
  return frac === 0.25 || frac === 0.75;
}

function settleAsian(diff: number, line: number): SettlementOutcome {
  if (isQuarterLine(line)) {
    const base = Math.floor(line * 2) / 2;
    const r1 = settleHalfStep(diff + base);
    const r2 = settleHalfStep(diff + base + 0.5);
    return combineHalf(r1, r2);
  }
  return settleHalfStep(diff + line);
}

export function settleMoneyline(selection: MlSelection, homeGoals: number, awayGoals: number): SettlementOutcome {
  const actual: MlSelection = homeGoals > awayGoals ? 'home' : homeGoals < awayGoals ? 'away' : 'draw';
  return actual === selection ? 'WIN' : 'LOSS';
}

export function settleBtts(selection: BttsSide, homeGoals: number, awayGoals: number): SettlementOutcome {
  const yes = homeGoals >= 1 && awayGoals >= 1;
  return (selection === 'yes' && yes) || (selection === 'no' && !yes) ? 'WIN' : 'LOSS';
}

export function settleAsianHandicap(selection: AhSide, line: number, homeGoals: number, awayGoals: number): SettlementOutcome {
  const diff = selection === 'home' ? homeGoals - awayGoals : awayGoals - homeGoals;
  return settleAsian(diff, line);
}

export function settleAsianTotal(selection: OuSide, line: number, totalGoals: number): SettlementOutcome {
  const diff = selection === 'over' ? totalGoals - line : line - totalGoals;
  if (isQuarterLine(line)) {
    const base = Math.floor(line * 2) / 2;
    const m1 = selection === 'over' ? totalGoals - base : base - totalGoals;
    const m2 = selection === 'over' ? totalGoals - (base + 0.5) : (base + 0.5) - totalGoals;
    return combineHalf(settleHalfStep(m1), settleHalfStep(m2));
  }
  return settleHalfStep(diff);
}

export function profitOfOutcome(outcome: SettlementOutcome, decimalOdds: number, stake = 1): number {
  switch (outcome) {
    case 'WIN': return (decimalOdds - 1) * stake;
    case 'HALF_WIN': return ((decimalOdds - 1) / 2) * stake;
    case 'PUSH': return 0;
    case 'HALF_LOSS': return -0.5 * stake;
    case 'LOSS': return -stake;
  }
}
