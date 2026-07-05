import { CalibrationEngine } from '../metadata/mlTraining';

export interface BacktestSummaryMetrics {
  roi: number;
  yield: number;
  netProfit: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  brierScore: number;
  totalBets: number;
}

export class MetricsEngine {
  /**
   * Compiles comprehensive yield, risk, and calibration statistics for a list of completed trades.
   */
  public static computeSummary(
    stakes: number[],
    returns: number[],
    predictions: number[],
    outcomes: number[]
  ): BacktestSummaryMetrics {
    const totalBets = stakes.length;
    if (totalBets === 0) {
      return { roi: 0, yield: 0, netProfit: 0, winRate: 0, maxDrawdown: 0, sharpeRatio: 0, brierScore: 0, totalBets: 0 };
    }

    const totalStaked = stakes.reduce((a, b) => a + b, 0);
    const totalReturned = returns.reduce((a, b) => a + b, 0);
    const netProfit = totalReturned - totalStaked;

    const roi = (netProfit / totalStaked) * 100;
    const yieldPct = roi; // Yield equals ROI when computed on total volume

    // Win Rate
    let wins = 0;
    for (let i = 0; i < totalBets; i++) {
      if (returns[i] > stakes[i]) wins++;
    }
    const winRate = (wins / totalBets) * 100;

    // Drawdown Calculation
    let currentBankroll = 1000.0;
    let peak = currentBankroll;
    let maxDrawdown = 0.0;
    const bankrollHistory: number[] = [];

    for (let i = 0; i < totalBets; i++) {
      currentBankroll += (returns[i] - stakes[i]);
      bankrollHistory.push(currentBankroll);
      if (currentBankroll > peak) peak = currentBankroll;
      const dd = ((peak - currentBankroll) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe-like Ratio (Mean Net Return / Volatility of Net Return)
    const returnsArray = stakes.map((s, idx) => returns[idx] - s);
    const meanReturn = netProfit / totalBets;
    const variance = returnsArray.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / totalBets;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0.0; // Scaled to typical trading year

    // Brier Score
    const brierScore = CalibrationEngine.computeBrierScore(predictions, outcomes);

    return {
      roi: Number(roi.toFixed(2)),
      yield: Number(yieldPct.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      brierScore,
      totalBets
    };
  }
}
