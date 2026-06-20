// Backtest Engine

export interface HistoricalPrediction {
  matchId: string;
  predictionType: 'asian_handicap' | 'over_under' | 'moneyline';
  predictedValue: string; // e.g. "home_-0.5", "over_2.5", "home_win"
  probability: number;
  fairOdds: number;
  marketOdds: number;
  edgePercent: number;
  actualResult: string; // e.g. "home_win", "under_2.5"
  correct: boolean;
}

export interface BacktestInput {
  predictions: HistoricalPrediction[];
  initialBankroll?: number;
  betSizeUnits?: number; // default flat betting e.g. 1 unit
}

export interface BacktestMetrics {
  totalBets: number;
  winningBets: number;
  losingBets: number;
  winRate: number; // percentage
  totalProfitUnits: number;
  roiPercent: number;
  averageProbability: number;
  brierScore: number; // measures calibration (lower is better, 0 to 1)
}

/**
 * Runs historical simulation of predictions and returns efficiency metrics.
 */
export function runBacktest(input: BacktestInput): BacktestMetrics {
  const { predictions, initialBankroll = 100, betSizeUnits = 1 } = input;

  let totalBets = 0;
  let winningBets = 0;
  let losingBets = 0;
  let totalProfitUnits = 0;
  let sumProbability = 0;
  let brierSum = 0;

  predictions.forEach((pred) => {
    // Only bet if edge is positive (our typical criteria)
    if (pred.edgePercent > 0) {
      totalBets++;
      sumProbability += pred.probability;

      // Brier Score calculation term: (probability - actual_binary)^2
      const actualBinary = pred.correct ? 1 : 0;
      brierSum += Math.pow(pred.probability - actualBinary, 2);

      if (pred.correct) {
        winningBets++;
        // Profit is betSize * (odds - 1)
        totalProfitUnits += betSizeUnits * (pred.marketOdds - 1);
      } else {
        losingBets++;
        // Loss is full bet size
        totalProfitUnits -= betSizeUnits;
      }
    }
  });

  const winRate = totalBets > 0 ? (winningBets / totalBets) * 100 : 0;
  const totalStaked = totalBets * betSizeUnits;
  const roiPercent = totalStaked > 0 ? (totalProfitUnits / totalStaked) * 100 : 0;
  const averageProbability = totalBets > 0 ? sumProbability / totalBets : 0;
  const brierScore = totalBets > 0 ? brierSum / totalBets : 0;

  return {
    totalBets,
    winningBets,
    losingBets,
    winRate: Number(winRate.toFixed(2)),
    totalProfitUnits: Number(totalProfitUnits.toFixed(2)),
    roiPercent: Number(roiPercent.toFixed(2)),
    averageProbability: Number(averageProbability.toFixed(4)),
    brierScore: Number(brierScore.toFixed(4)),
  };
}
