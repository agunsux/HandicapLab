// AH YIELD ENGINE — Canonical settlement wrapper.
// Delegates the actual quarter-line decomposition to the verified EPIC 56
// settlement core (single source of truth) and adds strict input validation,
// the signed settlement fraction, and return amounts.

import { settleAsianHandicap as settleCore } from '../ah-solo/ahSettlementEngine';
import type { AhSide, AhSettlementOutcome } from './ahTypes';

export interface AhSettlementResult {
  outcome: AhSettlementOutcome;
  isQuarterLine: boolean;
  componentLines: [number, number] | null;
  componentOutcomes: [AhSettlementOutcome, AhSettlementOutcome] | null;
  /**
   * Signed settlement fraction s ∈ {-1, -0.5, 0, +0.5, +1}.
   * P&L = s * (odds - 1) when s > 0, P&L = s when s <= 0, per unit stake.
   */
  settlementFraction: number;
  pnl: number;
  returnAmount: number;
  isVoid: boolean;
}

const QUARTER_EPSILON = 1e-9;

/** A canonical AH line must be a finite multiple of 0.25. */
export function isValidHandicapLine(line: unknown): line is number {
  if (typeof line !== 'number' || !Number.isFinite(line)) return false;
  const quarters = line / 0.25;
  return Math.abs(quarters - Math.round(quarters)) < 1e-9;
}

export function isQuarterHandicap(line: number): boolean {
  if (!isValidHandicapLine(line)) return false;
  const frac = Math.abs(line - Math.trunc(line));
  return Math.abs(frac - 0.25) < QUARTER_EPSILON || Math.abs(frac - 0.75) < QUARTER_EPSILON;
}

/** Quarter lines split into two adjacent half-lines: -0.25 → {-0.5, 0}. */
export function quarterComponents(line: number): [number, number] {
  if (!isQuarterHandicap(line)) {
    throw new Error(`quarterComponents: not a quarter line: ${line}`);
  }
  const base = Math.floor(line * 2) / 2;
  return [round2(base), round2(base + 0.5)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fractionOfOutcome(outcome: AhSettlementOutcome): number {
  switch (outcome) {
    case 'FULL_WIN': return 1;
    case 'HALF_WIN': return 0.5;
    case 'PUSH': return 0;
    case 'HALF_LOSS': return -0.5;
    case 'FULL_LOSS': return -1;
    case 'VOID': return 0;
  }
}

export interface AhSettlementInput {
  side: AhSide;
  /** Handicap line from the SELECTED side's perspective. */
  line: number;
  homeScore: number;
  awayScore: number;
  odds: number;
  stake?: number;
  voided?: boolean;
}

/**
 * Pure, deterministic AH settlement.
 * Throws for structurally invalid input (non-quarter-multiple lines, negative
 * or non-integer scores, odds <= 1). VOID is returned for explicitly voided
 * fixtures or unplayable score records.
 */
export function settleAhBet(input: AhSettlementInput): AhSettlementResult {
  const { side, line, homeScore, awayScore, odds, stake = 1, voided = false } = input;

  if (side !== 'home' && side !== 'away') {
    throw new Error(`settleAhBet: invalid side: ${String(side)}`);
  }
  if (!isValidHandicapLine(line)) {
    throw new Error(`settleAhBet: invalid handicap line (must be a multiple of 0.25): ${String(line)}`);
  }
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
    throw new Error(`settleAhBet: invalid scores: ${homeScore}-${awayScore}`);
  }
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new Error(`settleAhBet: invalid decimal odds (must be > 1.0): ${String(odds)}`);
  }
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new Error(`settleAhBet: invalid stake: ${String(stake)}`);
  }

  const detail = settleCore(side, line, homeScore, awayScore, odds, stake, voided);

  const settlementFraction = detail.isVoid ? 0 : fractionOfOutcome(detail.outcome);
  const pnl = Number(detail.profit.toFixed(6));
  const returnAmount = Number((stake + pnl).toFixed(6));

  return {
    outcome: detail.outcome,
    isQuarterLine: detail.isQuarterLine,
    componentLines: detail.componentLines ?? null,
    componentOutcomes: detail.componentOutcomes ?? null,
    settlementFraction,
    pnl,
    returnAmount,
    isVoid: detail.isVoid,
  };
}

/**
 * Normalized P&L for one evaluated bet (VOID excluded by callers):
 * FULL_WIN  = +(odds - 1)
 * HALF_WIN  = +0.5 * (odds - 1)
 * PUSH      = 0
 * HALF_LOSS = -0.5
 * FULL_LOSS = -1
 */
export function ahPnl(outcome: AhSettlementOutcome, odds: number, stake = 1): number {
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new Error(`ahPnl: invalid decimal odds: ${String(odds)}`);
  }
  const s = fractionOfOutcome(outcome);
  const pnl = s > 0 ? s * (odds - 1) * stake : s * stake;
  return Number(pnl.toFixed(6));
}
