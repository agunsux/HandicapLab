/**
 * Canonical Asian Handicap Settlement Engine
 * 
 * Supports all full-ball, half-ball, and quarter-ball lines:
 * [-2.00, -1.75, -1.50, -1.25, -1.00, -0.75, -0.50, -0.25, 0.00, +0.25, +0.50, +0.75, +1.00, +1.25, +1.50, +1.75, +2.00]
 * 
 * Settlement States:
 * - WIN: Full stake wins at decimal odds -> profit = odds - 1
 * - HALF_WIN: Half stake wins at decimal odds, half returned -> profit = (odds - 1) / 2
 * - PUSH: Full stake returned -> profit = 0
 * - HALF_LOSS: Half stake lost, half returned -> profit = -0.5
 * - LOSS: Full stake lost -> profit = -1.0
 * 
 * Strict Symmetry Invariants:
 * Home (Line L) vs Away (-L) on same score yields identical aggregate market payouts.
 */

export type AhOutcome = 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';

export interface AhSettlementResult {
  outcome: AhOutcome;
  profit: number;
  returnAmount: number;
}

/**
 * Settles a single Asian Handicap bet.
 * @param homeGoals Actual full-time goals scored by Home team
 * @param awayGoals Actual full-time goals scored by Away team
 * @param line The handicap line applied to the selected team (e.g., -0.75, 0, +0.25)
 * @param decimalOdds Decimal odds taken for the selection (e.g., 1.95)
 * @param stake Stake amount in units (default 1.0)
 */
export function settleAsianHandicapBet(
  homeGoals: number,
  awayGoals: number,
  line: number,
  decimalOdds: number,
  side: 'HOME' | 'AWAY' = 'HOME',
  stake: number = 1.0
): AhSettlementResult {
  // Goal difference relative to the selected side + handicap
  const selectedGoals = side === 'HOME' ? homeGoals : awayGoals;
  const opponentGoals = side === 'HOME' ? awayGoals : homeGoals;
  const effectiveDiff = (selectedGoals - opponentGoals) + line;

  // Normalized threshold comparison:
  // Full Win: effectiveDiff >= +0.50 (i.e. > 0.25 + eps)
  // Half Win: effectiveDiff == +0.25
  // Push:     effectiveDiff ==  0.00
  // Half Loss: effectiveDiff == -0.25
  // Full Loss: effectiveDiff <= -0.50 (i.e. < -0.25 - eps)
  const eps = 1e-6;

  let outcome: AhOutcome;
  let profit: number;

  if (effectiveDiff > 0.25 + eps) {
    // Full Win (effectiveDiff >= +0.5)
    outcome = 'WIN';
    profit = stake * (decimalOdds - 1);
  } else if (Math.abs(effectiveDiff - 0.25) < eps) {
    // Quarter-ball Half Win (effectiveDiff == +0.25)
    outcome = 'HALF_WIN';
    profit = (stake / 2) * (decimalOdds - 1);
  } else if (Math.abs(effectiveDiff) < eps) {
    // Full Push / Draw No Bet (effectiveDiff == 0.0)
    outcome = 'PUSH';
    profit = 0;
  } else if (Math.abs(effectiveDiff - (-0.25)) < eps) {
    // Quarter-ball Half Loss (effectiveDiff == -0.25)
    outcome = 'HALF_LOSS';
    profit = - (stake / 2);
  } else {
    // Full Loss (effectiveDiff <= -0.5)
    outcome = 'LOSS';
    profit = - stake;
  }

  return {
    outcome,
    profit: Number(profit.toFixed(4)),
    returnAmount: Number((stake + profit).toFixed(4)),
  };
}

/**
 * Calculates granular Asian Handicap Expected Value (EV) from bivariate score matrix.
 * Supports Quarter lines by separating P(fullWin), P(halfWin), P(push), P(halfLoss), P(loss).
 */
export function calculateAhExpectedValue(
  scoreProbs: { matrix: number[][]; maxGoals?: number },
  line: number,
  decimalOdds: number,
  side: 'HOME' | 'AWAY' = 'HOME'
): {
  ev: number;
  pWin: number;
  pHalfWin: number;
  pPush: number;
  pHalfLoss: number;
  pLoss: number;
  fairOdds: number | null;
} {
  const maxGoals = scoreProbs.maxGoals ?? scoreProbs.matrix.length - 1;
  let pWin = 0;
  let pHalfWin = 0;
  let pPush = 0;
  let pHalfLoss = 0;
  let pLoss = 0;

  const eps = 1e-6;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = scoreProbs.matrix[h]?.[a] || 0;
      if (p <= 0) continue;

      const sel = side === 'HOME' ? h : a;
      const opp = side === 'HOME' ? a : h;
      const eff = (sel - opp) + line;

      if (eff > 0.25 + eps) {
        pWin += p;
      } else if (Math.abs(eff - 0.25) < eps) {
        pHalfWin += p;
      } else if (Math.abs(eff) < eps) {
        pPush += p;
      } else if (Math.abs(eff - (-0.25)) < eps) {
        pHalfLoss += p;
      } else {
        pLoss += p;
      }
    }
  }

  const totalP = pWin + pHalfWin + pPush + pHalfLoss + pLoss || 1;
  const normWin = pWin / totalP;
  const normHalfWin = pHalfWin / totalP;
  const normPush = pPush / totalP;
  const normHalfLoss = pHalfLoss / totalP;
  const normLoss = pLoss / totalP;

  // Expected value per 1 unit stake:
  // EV = P(Win)*(Odds - 1) + P(HalfWin)*((Odds - 1)/2) + P(Push)*0 + P(HalfLoss)*(-0.5) + P(Loss)*(-1)
  const ev = (normWin * (decimalOdds - 1)) +
             (normHalfWin * ((decimalOdds - 1) / 2)) +
             (normHalfLoss * -0.5) +
             (normLoss * -1.0);

  // For Fair Odds (break-even decimal price):
  // Solving EV = 0:
  // Odds_fair = 1 + (0.5 * normHalfLoss + normLoss) / (normWin + 0.5 * normHalfWin)
  const winDenominator = normWin + 0.5 * normHalfWin;
  const fairOdds = winDenominator > 0
    ? 1 + (0.5 * normHalfLoss + normLoss) / winDenominator
    : null;

  return {
    ev: Number(ev.toFixed(4)),
    pWin: Number(normWin.toFixed(4)),
    pHalfWin: Number(normHalfWin.toFixed(4)),
    pPush: Number(normPush.toFixed(4)),
    pHalfLoss: Number(normHalfLoss.toFixed(4)),
    pLoss: Number(normLoss.toFixed(4)),
    fairOdds: fairOdds ? Number(fairOdds.toFixed(2)) : null,
  };
}
