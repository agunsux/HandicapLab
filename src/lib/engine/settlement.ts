/**
 * Pure settlement engine for HandicapLab.
 * Handles prediction resolution and accounting outcomes on a 1-unit stake basis.
 */

export type SettlementStatus = 'WON' | 'LOST' | 'HALF_WIN' | 'HALF_LOSS' | 'PUSH';

export interface SettlementResult {
  status: SettlementStatus;
  profit_units: number;
}

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Settlement module can only be used on the server side.');
}

/**
 * Settles an Asian Handicap prediction.
 * 
 * @param actualHomeGoals Number of goals scored by the home team.
 * @param actualAwayGoals Number of goals scored by the away team.
 * @param handicapLine The Asian Handicap line (e.g. -0.75, -0.5, 0.0, +1.0) relative to the home team.
 * @param selection Which team was selected ('home' | 'away').
 * @param odds Decimal odds of the selection (e.g. 1.95).
 */
export function settleAsianHandicap(
  actualHomeGoals: number,
  actualAwayGoals: number,
  handicapLine: number,
  selection: 'home' | 'away',
  odds: number
): SettlementResult {
  if (actualHomeGoals < 0 || actualAwayGoals < 0 || odds < 1.0) {
    return { status: 'LOST', profit_units: -1.0 };
  }

  // Calculate adjusted goal difference from the perspective of the selection
  const dAdj = selection === 'home'
    ? (actualHomeGoals - actualAwayGoals + handicapLine)
    : (actualAwayGoals - actualHomeGoals - handicapLine);

  let status: SettlementStatus;
  let profit_units: number;

  if (dAdj >= 0.5) {
    status = 'WON';
    profit_units = odds - 1.0;
  } else if (dAdj === 0.25) {
    status = 'HALF_WIN';
    profit_units = 0.5 * (odds - 1.0);
  } else if (dAdj === 0.0) {
    status = 'PUSH';
    profit_units = 0.0;
  } else if (dAdj === -0.25) {
    status = 'HALF_LOSS';
    profit_units = -0.5;
  } else {
    status = 'LOST';
    profit_units = -1.0;
  }

  return {
    status,
    profit_units: Number(profit_units.toFixed(4))
  };
}
