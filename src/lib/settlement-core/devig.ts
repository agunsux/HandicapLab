// ============================================================================
// CANONICAL DE-VIG LAYER  (Epic 31A — Section C, MANDATORY)
// ============================================================================
// This is the SINGLE source of truth for bookmaker margin (vig) removal in
// HandicapLab. Every fair-odds / EV / edge comparison elsewhere in the codebase
// MUST route through this module. See the Epic 31A final report for the list of
// legacy modules (MarketMath, MarginEngine, clvEngine, clv.ts, value-detector)
// that currently bypass it and must be migrated.
//
// METHOD CHOSEN: Proportional (multiplicative) margin removal is the canonical
// default. Rationale:
//   - Deterministic, O(n), no iterative solver, trivially reproducible.
//   - Makes no assumption about the proportion of "insider" money (unlike Shin),
//     which keeps it robust for thin/low-liquidity markets where Shin's z can be
//     unstable.
//   - Matches the method already used by the bulk of existing code paths, so
//     adopting it as canonical minimizes behavioural drift during migration.
// Shin's method is also provided (opt-in) for comparison on liquid markets.
// ============================================================================

export type DeVigMethod = 'proportional' | 'shin';

export interface DeVigResult {
  method: DeVigMethod;
  // Raw implied probabilities: p = 1 / decimal_odds
  implied: Record<string, number>;
  // Margin-removed ("fair") probabilities that sum to 1.0
  fair: Record<string, number>;
  // Overround = sum(implied) - 1.0 (0 = fair book, >0 = bookmaker margin)
  overround: number;
  // Bookmaker margin / hold = overround / sum(implied)
  margin: number;
  shinZ?: number;
}

function impliedFromOdds(odds: Record<string, number>): Record<string, number> {
  const implied: Record<string, number> = {};
  for (const [key, o] of Object.entries(odds)) {
    implied[key] = o && o > 1 ? 1 / o : 0;
  }
  return implied;
}

export function removeVigProportional(odds: Record<string, number>): DeVigResult {
  const implied = impliedFromOdds(odds);
  const sumImplied = Object.values(implied).reduce((a, b) => a + b, 0);
  const overround = sumImplied - 1;
  const fair: Record<string, number> = {};
  for (const [key, p] of Object.entries(implied)) {
    fair[key] = sumImplied > 0 ? p / sumImplied : 0;
  }
  const margin = sumImplied > 0 ? overround / sumImplied : 0;
  return {
    method: 'proportional',
    implied: roundAll(implied),
    fair: roundAll(fair),
    overround: round6(overround),
    margin: round6(margin),
  };
}

// Shin's method: bisection solve for insider proportion z such that fair probs
// sum to 1.0. Falls back to proportional when overround <= 0 or < 2 outcomes.
export function removeVigShin(
  odds: Record<string, number>,
  tolerance = 1e-9,
  maxIterations = 200
): DeVigResult {
  const implied = impliedFromOdds(odds);
  const sumImplied = Object.values(implied).reduce((a, b) => a + b, 0);
  const overround = sumImplied - 1;
  const keys = Object.keys(odds);

  if (overround <= 0 || keys.length < 2) {
    return removeVigProportional(odds);
  }

  let lowZ = 0;
  let highZ = 0.9999;
  let z = 0;
  for (let iter = 0; iter < maxIterations; iter++) {
    z = (lowZ + highZ) / 2;
    let sumFair = 0;
    for (const k of keys) {
      const pImplied = implied[k];
      const pFair =
        (Math.sqrt(z * z + 4 * (1 - z) * pImplied * pImplied) - z) / (2 * (1 - z));
      sumFair += pFair;
    }
    if (Math.abs(sumFair - 1) < tolerance) break;
    if (sumFair > 1) lowZ = z;
    else highZ = z;
  }

  const fair: Record<string, number> = {};
  for (const k of keys) {
    const pImplied = implied[k];
    fair[k] = (Math.sqrt(z * z + 4 * (1 - z) * pImplied * pImplied) - z) / (2 * (1 - z));
  }
  const margin = sumImplied > 0 ? overround / sumImplied : 0;
  return {
    method: 'shin',
    implied: roundAll(implied),
    fair: roundAll(fair),
    overround: round6(overround),
    margin: round6(margin),
    shinZ: round6(z),
  };
}

// Canonical entry point. Defaults to proportional.
export function removeVig(
  odds: Record<string, number>,
  method: DeVigMethod = 'proportional'
): DeVigResult {
  return method === 'shin' ? removeVigShin(odds) : removeVigProportional(odds);
}

// Fair (vig-removed) decimal odds for a single selection, given the full market.
export function fairOdds(
  odds: Record<string, number>,
  selection: string,
  method: DeVigMethod = 'proportional'
): number {
  const result = removeVig(odds, method);
  const fairProb = result.fair[selection];
  if (!fairProb || fairProb <= 0) return NaN;
  return round4(1 / fairProb);
}

// Expected value of a bet at TAKEN odds vs the fair (vig-removed) probability.
// Positive => the bet has a mathematical edge over the market.
export function expectedValue(
  takenOdds: number,
  fairProbability: number
): number {
  if (takenOdds <= 1 || fairProbability <= 0 || fairProbability >= 1) return NaN;
  return round6(fairProbability * takenOdds - 1);
}

/**
 * DeVigService — Unified canonical service for margin removal, fair odds, edge, and CLV.
 * Every core calculation MUST route through this service.
 */
export class DeVigService {
  public static removeVig(
    odds: Record<string, number>,
    method: DeVigMethod = 'proportional'
  ): DeVigResult {
    return removeVig(odds, method);
  }

  public static fairOdds(
    odds: Record<string, number>,
    selection: string,
    method: DeVigMethod = 'proportional'
  ): number {
    return fairOdds(odds, selection, method);
  }

  public static expectedValue(
    takenOdds: number,
    fairProbability: number
  ): number {
    return expectedValue(takenOdds, fairProbability);
  }

  public static edge(
    takenOdds: number,
    fairProbability: number
  ): number {
    return expectedValue(takenOdds, fairProbability);
  }

  public static clv(
    takenOdds: number,
    closingOdds: number | Record<string, number>,
    selection?: string,
    method: DeVigMethod = 'proportional'
  ): number {
    if (typeof closingOdds === 'number') {
      if (closingOdds <= 1 || takenOdds <= 1) return NaN;
      return round6(1 / closingOdds - 1 / takenOdds);
    }
    if (!selection) return NaN;
    const result = this.removeVig(closingOdds, method);
    const fairProb = result.fair[selection];
    if (!fairProb || fairProb <= 0 || takenOdds <= 1) return NaN;
    const takenImplied = 1 / takenOdds;
    return round6(fairProb - takenImplied);
  }
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}
function round4(n: number): number {
  return Number(n.toFixed(4));
}
function roundAll(r: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) out[k] = round6(v);
  return out;
}

