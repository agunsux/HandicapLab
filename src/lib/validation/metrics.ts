/**
 * HandicapLab Statistical Validation — Core Metrics
 * ===================================================
 * Comprehensive financial and statistical metrics for model evaluation.
 *
 * All metrics are pure functions with no side effects.
 * No production code is modified.
 */

export interface ValidationInput {
  predictedProbabilities: number[];
  actualOutcomes: number[];     // 1 = won, 0.5 = void, 0 = lost
  marketOdds: number[];
  stakes: number[];
  closingOdds?: number[];
}

export interface ValidationMetrics {
  roi: number;
  yield_: number;
  winRate: number;
  pushRate: number;
  totalBets: number;
  won: number;
  lost: number;
  pushed: number;
  totalStake: number;
  totalProfit: number;
  brierScore: number;
  logLoss: number;
  expectedValue: number;
  avgClv: number;
  kellyGrowth: number;
  avgEdge: number;
  variance: number;
  standardDeviation: number;
  sharpeRatio: number;
}

export function computeMetrics(input: ValidationInput): ValidationMetrics {
  const { predictedProbabilities, actualOutcomes, marketOdds, stakes, closingOdds } = input;
  const n = predictedProbabilities.length;
  if (n === 0) throw new Error('Cannot compute metrics on empty input');

  const won = actualOutcomes.filter((o) => o === 1).length;
  const lost = actualOutcomes.filter((o) => o === 0).length;
  const pushed = actualOutcomes.filter((o) => o === 0.5).length;
  const totalStake = stakes.reduce((a, b) => a + b, 0);

  const profits = actualOutcomes.map((outcome, i) => {
    if (outcome === 1) return stakes[i] * (marketOdds[i] - 1);
    if (outcome === 0.5) return 0;
    return -stakes[i];
  });
  const totalProfit = profits.reduce((a, b) => a + b, 0);
  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
  const yield_ = roi;

  // Brier Score
  const brierScore = predictedProbabilities.reduce((sum, p, i) => sum + Math.pow(p - actualOutcomes[i], 2), 0) / n;

  // Log Loss
  const logLoss = predictedProbabilities.reduce((sum, p, i) => {
    const outcome = actualOutcomes[i];
    if (outcome === 0.5) return sum;
    if (outcome === 1) return sum - Math.log(Math.max(0.001, p));
    return sum - Math.log(Math.max(0.001, 1 - p));
  }, 0) / (n - pushed);

  // Expected Value
  const expectedValue = predictedProbabilities.reduce((sum, p, i) => sum + (p * marketOdds[i] - 1), 0) / n;

  // CLV
  const avgClv = closingOdds && closingOdds.length > 0
    ? marketOdds.reduce((sum, odds, i) => {
        const close = closingOdds[i] || odds;
        return sum + (odds / close - 1);
      }, 0) / closingOdds.length
    : 0;

  // Kelly Growth
  const growthRates = profits.map((profit, i) => Math.log(1 + profit / stakes[i]));
  const totalGrowth = growthRates.reduce((a, b) => a + b, 0);
  const kellyGrowth = totalGrowth;

  // Avg Edge
  const edges = predictedProbabilities.map((p, i) => p * marketOdds[i] - 1);
  const avgEdge = edges.reduce((a, b) => a + b, 0) / n;

  // Variance & Std Dev
  const avgProfit = totalProfit / n;
  const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / n;
  const standardDeviation = Math.sqrt(variance);

  // Sharpe Ratio (profit per unit risk)
  const sharpeRatio = standardDeviation > 0 ? avgProfit / standardDeviation * Math.sqrt(n) : 0;

  return {
    roi: Math.round(roi * 10000) / 10000,
    yield_: Math.round(yield_ * 10000) / 10000,
    winRate: n > 0 ? Math.round((won / n) * 10000) / 100 : 0,
    pushRate: n > 0 ? Math.round((pushed / n) * 10000) / 100 : 0,
    totalBets: n,
    won,
    lost,
    pushed,
    totalStake: Math.round(totalStake * 10000) / 10000,
    totalProfit: Math.round(totalProfit * 10000) / 10000,
    brierScore: Math.round(brierScore * 10000) / 10000,
    logLoss: Math.round(logLoss * 10000) / 10000,
    expectedValue: Math.round(expectedValue * 10000) / 10000,
    avgClv: Math.round(avgClv * 10000) / 10000,
    kellyGrowth: Math.round(kellyGrowth * 10000) / 10000,
    avgEdge: Math.round(avgEdge * 10000) / 10000,
    variance: Math.round(variance * 10000) / 10000,
    standardDeviation: Math.round(standardDeviation * 10000) / 10000,
    sharpeRatio: Math.round(sharpeRatio * 10000) / 10000,
  };
}