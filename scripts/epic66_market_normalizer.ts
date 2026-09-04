// Deterministic Market Normalizer for EPIC-66
// Location: scripts/epic66_market_normalizer.ts
// Scope: Asian Handicap, Over/Under, BTTS canonical normalization

export type NormalizedMarketType = 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS' | 'MONEYLINE';
export type CanonicalAhSide = 'home' | 'away';
export type CanonicalOuSide = 'over' | 'under';
export type CanonicalBttsSide = 'yes' | 'no';

export interface CanonicalAhMarket {
  marketType: 'ASIAN_HANDICAP';
  line: number; // numeric line from home perspective (-0.25, 0.0, +0.5, etc.)
  side: CanonicalAhSide;
  effectiveLine: number; // line from bet perspective
  label: string;
}

export interface CanonicalOuMarket {
  marketType: 'OVER_UNDER';
  line: number; // total line (2.25, 2.5, 2.75, etc.)
  side: CanonicalOuSide;
  label: string;
}

export interface CanonicalBttsMarket {
  marketType: 'BTTS';
  side: CanonicalBttsSide;
  label: string;
}

export type CanonicalMarketSelection = CanonicalAhMarket | CanonicalOuMarket | CanonicalBttsMarket;

/**
 * Normalizes Asian Handicap line representations into standard float.
 * Handles split notation (e.g. "-0.25", "0.0, -0.5", "-0.25 / -0.5", "+0.75").
 */
export function normalizeAhLine(rawLine: string | number): number {
  if (typeof rawLine === 'number') {
    return Math.round(rawLine * 4) / 4;
  }

  const clean = String(rawLine).trim().replace(/[\+]/g, '');
  if (clean.includes(',') || clean.includes('/')) {
    const parts = clean.split(/[,\/]/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    if (parts.length === 2) {
      return Math.round(((parts[0] + parts[1]) / 2) * 4) / 4;
    }
  }

  const parsed = parseFloat(clean);
  if (isNaN(parsed)) {
    throw new Error(`Invalid Asian Handicap line: ${rawLine}`);
  }
  return Math.round(parsed * 4) / 4;
}

/**
 * Normalizes Over/Under line representations into standard float.
 */
export function normalizeOuLine(rawLine: string | number): number {
  if (typeof rawLine === 'number') {
    return Math.round(rawLine * 4) / 4;
  }

  const clean = String(rawLine).trim().toLowerCase().replace(/^(over|under|o|u)\s*/i, '');
  if (clean.includes(',') || clean.includes('/')) {
    const parts = clean.split(/[,\/]/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    if (parts.length === 2) {
      return Math.round(((parts[0] + parts[1]) / 2) * 4) / 4;
    }
  }

  const parsed = parseFloat(clean);
  if (isNaN(parsed)) {
    throw new Error(`Invalid Over/Under line: ${rawLine}`);
  }
  return Math.round(parsed * 4) / 4;
}

/**
 * Normalizes BTTS selections.
 */
export function normalizeBttsSelection(raw: string): CanonicalBttsSide {
  const clean = String(raw).trim().toLowerCase();
  if (clean === 'yes' || clean === 'y' || clean === 'btts_yes' || clean === '1') return 'yes';
  if (clean === 'no' || clean === 'n' || clean === 'btts_no' || clean === '0') return 'no';
  throw new Error(`Invalid BTTS selection: ${raw}`);
}

/**
 * Validates whether an AH line is on the canonical discrete grid (step 0.25).
 */
export function isValidAhLine(line: number): boolean {
  const remainder = Math.abs(line * 4) % 1;
  return remainder < 0.0001 || remainder > 0.9999;
}

/**
 * Validates whether an OU line is on the canonical discrete grid (step 0.25).
 */
export function isValidOuLine(line: number): boolean {
  if (line < 0.5 || line > 6.5) return false;
  const remainder = Math.abs(line * 4) % 1;
  return remainder < 0.0001 || remainder > 0.9999;
}
