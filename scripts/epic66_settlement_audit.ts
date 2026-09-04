import {
  settleAsianHandicap,
  settleAsianTotal,
  settleBtts,
  profitOfOutcome,
  type SettlementOutcome
} from '../src/historical/settlement/settlement';
import { normalizeAhLine, normalizeOuLine, normalizeBttsSelection } from './epic66_market_normalizer';

interface TestVector {
  market: 'AH' | 'OU' | 'BTTS';
  selection: string;
  line: number;
  homeGoals: number;
  awayGoals: number;
  expectedOutcome: SettlementOutcome;
  expectedProfitAtOdds2: number; // profit at decimal odds = 2.00, stake = 1.0
}

const TEST_VECTORS: TestVector[] = [
  // --- AH Level / DNB (0.00) ---
  { market: 'AH', selection: 'home', line: 0.0, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: 0.0, homeGoals: 1, awayGoals: 1, expectedOutcome: 'PUSH', expectedProfitAtOdds2: 0.0 },
  { market: 'AH', selection: 'home', line: 0.0, homeGoals: 0, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
  { market: 'AH', selection: 'away', line: 0.0, homeGoals: 1, awayGoals: 1, expectedOutcome: 'PUSH', expectedProfitAtOdds2: 0.0 },

  // --- AH -0.25 Quarter Line ---
  { market: 'AH', selection: 'home', line: -0.25, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: -0.25, homeGoals: 1, awayGoals: 1, expectedOutcome: 'HALF_LOSS', expectedProfitAtOdds2: -0.5 },
  { market: 'AH', selection: 'home', line: -0.25, homeGoals: 0, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- AH +0.25 Quarter Line ---
  { market: 'AH', selection: 'home', line: 0.25, homeGoals: 1, awayGoals: 1, expectedOutcome: 'HALF_WIN', expectedProfitAtOdds2: 0.5 },
  { market: 'AH', selection: 'home', line: 0.25, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: 0.25, homeGoals: 0, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- AH -0.50 Half Line ---
  { market: 'AH', selection: 'home', line: -0.5, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: -0.5, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
  { market: 'AH', selection: 'away', line: -0.5, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
  { market: 'AH', selection: 'away', line: 0.5, homeGoals: 1, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },

  // --- AH -0.75 Quarter Line ---
  { market: 'AH', selection: 'home', line: -0.75, homeGoals: 2, awayGoals: 0, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: -0.75, homeGoals: 2, awayGoals: 1, expectedOutcome: 'HALF_WIN', expectedProfitAtOdds2: 0.5 },
  { market: 'AH', selection: 'home', line: -0.75, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- AH +0.75 Quarter Line ---
  { market: 'AH', selection: 'home', line: 0.75, homeGoals: 1, awayGoals: 2, expectedOutcome: 'HALF_LOSS', expectedProfitAtOdds2: -0.5 },
  { market: 'AH', selection: 'home', line: 0.75, homeGoals: 1, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: 0.75, homeGoals: 0, awayGoals: 2, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- AH -1.00 Integer Line ---
  { market: 'AH', selection: 'home', line: -1.0, homeGoals: 3, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'AH', selection: 'home', line: -1.0, homeGoals: 2, awayGoals: 1, expectedOutcome: 'PUSH', expectedProfitAtOdds2: 0.0 },
  { market: 'AH', selection: 'home', line: -1.0, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- OU 2.00 Integer Total ---
  { market: 'OU', selection: 'over', line: 2.0, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'OU', selection: 'over', line: 2.0, homeGoals: 1, awayGoals: 1, expectedOutcome: 'PUSH', expectedProfitAtOdds2: 0.0 },
  { market: 'OU', selection: 'over', line: 2.0, homeGoals: 1, awayGoals: 0, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- OU 2.25 Quarter Total ---
  { market: 'OU', selection: 'over', line: 2.25, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'OU', selection: 'over', line: 2.25, homeGoals: 1, awayGoals: 1, expectedOutcome: 'HALF_LOSS', expectedProfitAtOdds2: -0.5 },
  { market: 'OU', selection: 'over', line: 2.25, homeGoals: 1, awayGoals: 0, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
  { market: 'OU', selection: 'under', line: 2.25, homeGoals: 1, awayGoals: 1, expectedOutcome: 'HALF_WIN', expectedProfitAtOdds2: 0.5 },

  // --- OU 2.50 Half Total ---
  { market: 'OU', selection: 'over', line: 2.5, homeGoals: 2, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'OU', selection: 'over', line: 2.5, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },

  // --- OU 2.75 Quarter Total ---
  { market: 'OU', selection: 'over', line: 2.75, homeGoals: 3, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'OU', selection: 'over', line: 2.75, homeGoals: 2, awayGoals: 1, expectedOutcome: 'HALF_WIN', expectedProfitAtOdds2: 0.5 },
  { market: 'OU', selection: 'over', line: 2.75, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
  { market: 'OU', selection: 'under', line: 2.75, homeGoals: 2, awayGoals: 1, expectedOutcome: 'HALF_LOSS', expectedProfitAtOdds2: -0.5 },

  // --- BTTS Yes / No ---
  { market: 'BTTS', selection: 'yes', line: 0, homeGoals: 1, awayGoals: 1, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'BTTS', selection: 'yes', line: 0, homeGoals: 2, awayGoals: 0, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
  { market: 'BTTS', selection: 'no', line: 0, homeGoals: 2, awayGoals: 0, expectedOutcome: 'WIN', expectedProfitAtOdds2: 1.0 },
  { market: 'BTTS', selection: 'no', line: 0, homeGoals: 1, awayGoals: 1, expectedOutcome: 'LOSS', expectedProfitAtOdds2: -1.0 },
];

export function runSettlementAudit() {
  console.log('===============================================================');
  console.log('EPIC 66 — Deterministic Settlement Audit Verification');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  for (const v of TEST_VECTORS) {
    let outcome: SettlementOutcome;
    if (v.market === 'AH') {
      outcome = settleAsianHandicap(v.selection as any, v.line, v.homeGoals, v.awayGoals);
    } else if (v.market === 'OU') {
      outcome = settleAsianTotal(v.selection as any, v.line, v.homeGoals + v.awayGoals);
    } else {
      outcome = settleBtts(v.selection as any, v.homeGoals, v.awayGoals);
    }

    const profit = profitOfOutcome(outcome, 2.0, 1.0);
    const outcomeMatch = outcome === v.expectedOutcome;
    const profitMatch = Math.abs(profit - v.expectedProfitAtOdds2) < 0.0001;

    if (outcomeMatch && profitMatch) {
      passed++;
    } else {
      failed++;
      console.error(
        `[FAIL] ${v.market} ${v.selection} ${v.line} (${v.homeGoals}-${v.awayGoals}): ` +
        `expected ${v.expectedOutcome} (profit ${v.expectedProfitAtOdds2}), got ${outcome} (profit ${profit})`
      );
    }
  }

  console.log(`\nSettlement Audit Results:`);
  console.log(`  Total Vectors: ${TEST_VECTORS.length}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  if (failed > 0) {
    throw new Error(`Settlement audit failed with ${failed} mismatches.`);
  }

  console.log('\n[PASS] All Asian Handicap, Over/Under, and BTTS settlement vectors verified 100% correct!\n');
}

if (require.main === module) {
  runSettlementAudit();
}
