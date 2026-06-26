/**
 * Kelly Criterion Engine for HandicapLab.
 * Computes optimal theoretical bankroll allocation fractions.
 */

export interface KellyOutput {
  stakeFraction: number;
  mode: 'validation' | 'early' | 'mature';
  sampleSize: number;
}

/**
 * Calculates the Kelly Criterion stake fraction using Model Maturity Gates.
 * 
 * @param odds Decimal odds of the selection (e.g., 2.10)
 * @param probability Model probability of winning (e.g., 0.55)
 * @param maxStakePct Maximum bankroll percentage cap (e.g., 5.0 for 5%)
 * @param settledSignalCount The number of settled signals to determine the gate mode
 */
export function calculateKelly(
  odds: number,
  probability: number,
  maxStakePct: number = 5.0,
  settledSignalCount: number = 0
): KellyOutput {
  if (odds <= 1.0 || probability <= 0.0 || probability >= 1.0) {
    return { stakeFraction: 0.0, mode: settledSignalCount < 100 ? 'validation' : (settledSignalCount < 200 ? 'early' : 'mature'), sampleSize: settledSignalCount };
  }

  const b = odds - 1.0;
  const q = 1.0 - probability;
  const rawFraction = (b * probability - q) / b;

  if (rawFraction <= 0.0) {
    return { stakeFraction: 0.0, mode: settledSignalCount < 100 ? 'validation' : (settledSignalCount < 200 ? 'early' : 'mature'), sampleSize: settledSignalCount };
  }

  let mode: 'validation' | 'early' | 'mature' = 'validation';
  let fractionMultiplier = 0.0;
  let stakeFraction = 0.0;

  if (settledSignalCount < 100) {
    mode = 'validation';
    stakeFraction = 0.01; // Flat 1%
  } else if (settledSignalCount < 200) {
    mode = 'early';
    fractionMultiplier = 0.10; // 10% Kelly
    stakeFraction = fractionMultiplier * rawFraction;
  } else {
    mode = 'mature';
    fractionMultiplier = 0.25; // 25% Kelly
    stakeFraction = fractionMultiplier * rawFraction;
  }

  // Cap the fraction at the maximum stake percentage (converted to decimal fraction)
  const cap = maxStakePct / 100.0;
  stakeFraction = Math.min(stakeFraction, cap);

  return {
    stakeFraction: Number(stakeFraction.toFixed(4)),
    mode,
    sampleSize: settledSignalCount
  };
}
