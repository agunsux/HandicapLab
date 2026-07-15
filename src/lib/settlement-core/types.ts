// Shared types for the Settlement Core package (Epic 31A).
// This package EXTENDS the existing live pipeline (fixtures / odds_snapshots /
// prediction_snapshots / settlements) without modifying or rewriting it.

export type MarketType = 'moneyline' | 'asian_handicap' | 'over_under';

// Canonical settlement outcomes required by Epic 31A D.
export type SettlementOutcome =
  | 'WIN'
  | 'HALF_WIN'
  | 'PUSH'
  | 'HALF_LOSS'
  | 'LOSS'
  | 'VOID';

export type Selection =
  | 'home'
  | 'draw'
  | 'away'
  | 'over'
  | 'under';

export interface SettlementInput {
  homeGoals: number;
  awayGoals: number;
  line: number; // AH line (signed toward home) or O/U total
  selection: Selection;
  odds: number; // decimal odds of the selection
  voided?: boolean; // match cancelled / postponed / abandoned
}

export interface SettlementResult {
  outcome: SettlementOutcome;
  profitUnits: number; // 1-unit stake basis; PUSH/VOID = 0
}

// A single stored odds observation (mirrors the odds_snapshots table row shape
// that this epic extends). All monetary/odds values are decimal.
export interface OddsTick {
  provider: string;
  fixtureId: string;
  market: MarketType;
  line: number;
  selection: Selection;
  odds: number;
  capturedAt: Date | string;
  providerLatencyMs?: number;
  rawPayloadId?: string | null;
}

export interface PerformanceLedgerInput {
  stakeUnits: number;
  oddsTaken: number;
  profitUnits: number; // settled P/L in units
  edge: number; // model edge as a fraction (0.05 = +5%)
  closingOdds?: number; // optional, for CLV
  voided?: boolean;
  settledAt: Date | string;
}

export interface PerformanceLedgerRow {
  roi: number;
  yield: number;
  clv: number | null;
  profitLossUnits: number;
  avgOdds: number | null;
  avgEdge: number | null;
  strikeRate: number;
  maxDrawdown: number;
  sampleSize: number;
  dateRange: { start: string; end: string };
  confidenceNote: string;
}
