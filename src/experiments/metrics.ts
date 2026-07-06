// HandicapLab Reusable Metrics Module
// Location: src/experiments/metrics.ts

export interface SimulatedBet {
  matchId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  odds: number;
  modelProb: number;
  edge: number;
  stake: number;
  profit: number;
  isWin: boolean;
}

export interface DecileCalibration {
  decile: number;
  count: number;
  avgModelProb: number;
  avgImpliedProb: number;
  brierScore: number;
  logLoss: number;
}

export interface ExperimentMetrics {
  totalBets: number;
  winningBets: number;
  losingBets: number;
  winRatePct: number;
  totalVolume: number;
  totalProfitUnits: number;
  roiPct: number;
  yieldPct: number;
  brierScore: number;
  logLoss: number;
  maxDrawdown: number;
  averageOdds: number;
  averageEdge: number;
  longestLosingStreak: number;
  longestWinningStreak: number;
  calibrationDeciles: DecileCalibration[];
}

export class MetricsEngine {
  /**
   * Calculates comprehensive yield, calibration, and drawdowns from a series of bets.
   */
  public static calculate(bets: SimulatedBet[]): ExperimentMetrics {
    let winningBets = 0;
    let losingBets = 0;
    let totalVolume = 0;
    let totalProfitUnits = 0;
    let brierScoreSum = 0;
    let logLossSum = 0;
    let edgeSum = 0;
    let oddsSum = 0;

    // Drawdown
    let bankroll = 100.0;
    let peak = 100.0;
    let maxDrawdown = 0.0;

    // Streaks
    let currentWinStreak = 0;
    let currentLoseStreak = 0;
    let longestWinningStreak = 0;
    let longestLosingStreak = 0;

    bets.forEach(b => {
      totalVolume += b.stake;
      totalProfitUnits += b.profit;
      edgeSum += b.edge;
      oddsSum += b.odds;

      // Calibration terms
      const actualBinary = b.isWin ? 1 : 0;
      brierScoreSum += Math.pow(b.modelProb - actualBinary, 2);
      logLossSum += -1 * (actualBinary * Math.log(Math.max(0.001, b.modelProb)) + (1 - actualBinary) * Math.log(Math.max(0.001, 1 - b.modelProb)));

      if (b.isWin) {
        winningBets++;
        currentWinStreak++;
        currentLoseStreak = 0;
        if (currentWinStreak > longestWinningStreak) longestWinningStreak = currentWinStreak;
      } else {
        losingBets++;
        currentLoseStreak++;
        currentWinStreak = 0;
        if (currentLoseStreak > longestLosingStreak) longestLosingStreak = currentLoseStreak;
      }

      bankroll += b.profit;
      if (bankroll > peak) peak = bankroll;
      const dd = peak - bankroll;
      if (dd > maxDrawdown) maxDrawdown = dd;
    });

    const totalBets = bets.length;
    const winRatePct = totalBets > 0 ? (winningBets / totalBets) * 100 : 0.0;
    const roiPct = totalVolume > 0 ? (totalProfitUnits / totalVolume) * 100 : 0.0;
    const yieldPct = roiPct;
    const brierScore = totalBets > 0 ? brierScoreSum / totalBets : 0.0;
    const logLoss = totalBets > 0 ? logLossSum / totalBets : 0.0;
    const averageOdds = totalBets > 0 ? oddsSum / totalBets : 0.0;
    const averageEdge = totalBets > 0 ? edgeSum / totalBets : 0.0;

    // Calculate calibration deciles
    const calibrationDeciles: DecileCalibration[] = [];
    for (let d = 0; d < 10; d++) {
      const minP = d / 10;
      const maxP = (d + 1) / 10;
      const subset = bets.filter(b => b.modelProb >= minP && b.modelProb < maxP);

      let dWin = 0;
      let dModelSum = 0;
      let dBrierSum = 0;
      let dLogLossSum = 0;

      subset.forEach(b => {
        const isWin = b.profit > 0;
        if (isWin) dWin++;
        dModelSum += b.modelProb;

        const actVal = isWin ? 1 : 0;
        dBrierSum += Math.pow(b.modelProb - actVal, 2);
        dLogLossSum += -1 * (actVal * Math.log(Math.max(0.001, b.modelProb)) + (1 - actVal) * Math.log(Math.max(0.001, 1 - b.modelProb)));
      });

      calibrationDeciles.push({
        decile: d + 1,
        count: subset.length,
        avgModelProb: subset.length > 0 ? Number((dModelSum / subset.length).toFixed(3)) : 0.0,
        avgImpliedProb: subset.length > 0 ? Number((dWin / subset.length).toFixed(3)) : 0.0,
        brierScore: subset.length > 0 ? Number((dBrierSum / subset.length).toFixed(4)) : 0.0,
        logLoss: subset.length > 0 ? Number((dLogLossSum / subset.length).toFixed(4)) : 0.0
      });
    }

    return {
      totalBets,
      winningBets,
      losingBets,
      winRatePct: Number(winRatePct.toFixed(2)),
      totalVolume: Number(totalVolume.toFixed(2)),
      totalProfitUnits: Number(totalProfitUnits.toFixed(2)),
      roiPct: Number(roiPct.toFixed(2)),
      yieldPct: Number(yieldPct.toFixed(2)),
      brierScore: Number(brierScore.toFixed(4)),
      logLoss: Number(logLoss.toFixed(4)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      averageOdds: Number(averageOdds.toFixed(2)),
      averageEdge: Number(averageEdge.toFixed(2)),
      longestLosingStreak,
      longestWinningStreak,
      calibrationDeciles
    };
  }
}
