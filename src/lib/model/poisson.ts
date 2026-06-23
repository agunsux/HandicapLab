/**
 * Calculates Poisson probability: P(k; lambda) = (lambda^k * e^-lambda) / k!
 */
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export interface PoissonOutput {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  overProb: number;
  underProb: number;
  bttsYesProb: number;
  bttsNoProb: number;
  ahHomeProb: number;
  ahAwayProb: number;
}

/**
 * Computes match probabilities from expected goals (lambdas) for home and away.
 */
export function calculatePoissonProbabilities(
  lambdaHome: number,
  lambdaAway: number,
  ouLine: number = 2.5,
  ahLine: number = 0
): PoissonOutput {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let overOU = 0;
  let bttsYes = 0;
  
  // Asian Handicap cover probabilities
  let homeCover = 0;
  let pushCount = 0;

  // Compute up to 10 goals (covers >99.99% of occurrences)
  const maxGoals = 10;
  const homeProbs: number[] = [];
  const awayProbs: number[] = [];

  for (let i = 0; i <= maxGoals; i++) {
    homeProbs.push(poissonProbability(i, lambdaHome));
    awayProbs.push(poissonProbability(i, lambdaAway));
  }

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = homeProbs[h] * awayProbs[a];
      
      // 1X2 Match Winner
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;

      // Over/Under
      if (h + a > ouLine) overOU += p;

      // BTTS (Both Teams to Score)
      if (h >= 1 && a >= 1) bttsYes += p;

      // Asian Handicap
      const diff = h - a; // home goals - away goals
      const net = diff + ahLine; // note: handicap line is added to home goal difference. If ahLine is -0.5, then home needs to win by >= 1
      if (net > 0) {
        homeCover += p;
      } else if (net === 0) {
        pushCount += p;
      }
    }
  }

  // Normalize Match Winner probabilities
  const totalMl = homeWin + draw + awayWin;
  const homeProb = homeWin / (totalMl || 1);
  const drawProb = draw / (totalMl || 1);
  const awayProb = awayWin / (totalMl || 1);

  // Asian Handicap cover probability (push count is split equally or treated as half win/half refund)
  const ahHomeProb = homeCover + 0.5 * pushCount;

  return {
    homeProb,
    drawProb,
    awayProb,
    overProb: overOU,
    underProb: 1 - overOU,
    bttsYesProb: bttsYes,
    bttsNoProb: 1 - bttsYes,
    ahHomeProb,
    ahAwayProb: 1 - ahHomeProb
  };
}
