// AH YIELD ENGINE — In-process settlement invariants.
//
// Independent brute-force reference: split the stake across the literal
// component lines (quarter lines split into two halves) and settle each
// component with a naive margin check, then compare the total P&L with the
// canonical engine. Any disagreement is a failure.

import { isValidHandicapLine, quarterComponents, settleAhBet } from './ahSettlement';

export interface SettlementSelfCheck {
  checked: number;
  passed: number;
  failed: number;
  failures: string[];
}

function naiveHalfLinePnl(margin: number, line: number, odds: number, stake: number): number {
  // line must be a multiple of 0.5; margin is the goal difference from the side's view.
  const m = margin + line;
  if (m > 1e-9) return stake * (odds - 1);
  if (m < -1e-9) return -stake;
  return 0;
}

export function runSettlementInvariants(options: { maxGoals?: number; maxLine?: number } = {}): SettlementSelfCheck {
  const maxGoals = options.maxGoals ?? 5;
  const maxLine = options.maxLine ?? 4;
  let checked = 0;
  let passed = 0;
  const failures: string[] = [];

  const lines: number[] = [];
  for (let l = -maxLine; l <= maxLine + 1e-9; l += 0.25) {
    lines.push(Math.round(l * 100) / 100);
  }

  for (const line of lines) {
    if (!isValidHandicapLine(line)) continue;
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        for (const side of ['home', 'away'] as const) {
          const diff = side === 'home' ? h - a : a - h;
          const odds = 1.9;
          const stake = 1;
          const engine = settleAhBet({ side, line, homeScore: h, awayScore: a, odds, stake });
          let reference: number;
          if (engine.isQuarterLine) {
            const [l1, l2] = quarterComponents(line);
            reference =
              naiveHalfLinePnl(diff, l1, odds, stake / 2) + naiveHalfLinePnl(diff, l2, odds, stake / 2);
          } else {
            reference = naiveHalfLinePnl(diff, line, odds, stake);
          }
          checked += 1;
          if (Math.abs(engine.pnl - reference) < 1e-9) {
            passed += 1;
          } else if (failures.length < 20) {
            failures.push(
              `side=${side} line=${line} score=${h}:${a} engine=${engine.pnl} reference=${reference}`
            );
          }
        }
      }
    }
  }

  // VOID must always be flat.
  checked += 1;
  const voided = settleAhBet({ side: 'home', line: -0.75, homeScore: 2, awayScore: 1, odds: 1.9, voided: true });
  if (voided.pnl === 0 && voided.outcome === 'VOID') passed += 1;
  else failures.push('VOID settlement is not flat');

  return { checked, passed, failed: checked - passed, failures };
}
