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
  competitionType?: 'club' | 'international';
  leagueId?: string;
  clv?: number | null;
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
  yieldPercent: number;
  averageProbability: number;
  brierScore: number; // measures calibration (lower is better, 0 to 1)
  averageClv: number;
  maxDrawdown: number;
  sharpeRatio: number;
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
  let clvSum = 0;
  let clvCount = 0;

  // Track drawdown
  let runningBankroll = initialBankroll;
  let peak = initialBankroll;
  let maxDrawdown = 0;

  // Track returns for Sharpe Ratio
  const betReturns: number[] = [];

  predictions.forEach((pred) => {
    // Only bet if edge is positive (our typical criteria)
    if (pred.edgePercent > 0) {
      totalBets++;
      sumProbability += pred.probability;

      // Brier Score calculation term: (probability - actual_binary)^2
      const actualBinary = pred.correct ? 1 : 0;
      brierSum += Math.pow(pred.probability - actualBinary, 2);

      if (pred.clv !== undefined && pred.clv !== null) {
        clvSum += pred.clv;
        clvCount++;
      }

      let profit = 0;
      if (pred.correct) {
        winningBets++;
        profit = betSizeUnits * (pred.marketOdds - 1);
      } else {
        losingBets++;
        profit = -betSizeUnits;
      }

      totalProfitUnits += profit;
      betReturns.push(profit);

      runningBankroll += profit;
      if (runningBankroll > peak) {
        peak = runningBankroll;
      }
      const dd = peak - runningBankroll;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
    }
  });

  const winRate = totalBets > 0 ? (winningBets / totalBets) * 100 : 0;
  const totalStaked = totalBets * betSizeUnits;
  const roiPercent = totalStaked > 0 ? (totalProfitUnits / totalStaked) * 100 : 0;
  const yieldPercent = roiPercent; // standard yield is profit/turnover
  const averageProbability = totalBets > 0 ? sumProbability / totalBets : 0;
  const brierScore = totalBets > 0 ? brierSum / totalBets : 0;
  const averageClv = clvCount > 0 ? clvSum / clvCount : 0;

  // Sharpe Ratio calculation
  let sharpeRatio = 0;
  if (totalBets > 1) {
    const meanReturn = totalProfitUnits / totalBets;
    const varianceSum = betReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0);
    const standardDeviation = Math.sqrt(varianceSum / (totalBets - 1));
    sharpeRatio = standardDeviation > 0 ? meanReturn / standardDeviation : 0;
  }

  return {
    totalBets,
    winningBets,
    losingBets,
    winRate: Number(winRate.toFixed(2)),
    totalProfitUnits: Number(totalProfitUnits.toFixed(2)),
    roiPercent: Number(roiPercent.toFixed(2)),
    yieldPercent: Number(yieldPercent.toFixed(2)),
    averageProbability: Number(averageProbability.toFixed(4)),
    brierScore: Number(brierScore.toFixed(4)),
    averageClv: Number(averageClv.toFixed(4)),
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(4))
  };
}

export interface SegmentedReport {
  overall: BacktestMetrics;
  marketSegments: Record<string, BacktestMetrics>;
  confidenceSegments: Record<string, BacktestMetrics>;
  competitionSegments: Record<string, BacktestMetrics>;
}

/**
 * Runs historical simulation segmented by market, confidence bucket, and competition type.
 */
export function runSegmentedBacktest(predictions: HistoricalPrediction[]): SegmentedReport {
  // 1. Overall
  const overall = runBacktest({ predictions });

  // 2. Segment by Market Type (AH, OU, ML)
  const markets = ['ML', 'AH', 'OU'];
  const marketSegments: Record<string, BacktestMetrics> = {};
  markets.forEach(m => {
    const subset = predictions.filter(p => {
      if (m === 'ML') return p.predictionType === 'moneyline';
      if (m === 'AH') return p.predictionType === 'asian_handicap';
      return p.predictionType === 'over_under';
    });
    marketSegments[m] = runBacktest({ predictions: subset });
  });

  // 3. Segment by Confidence Buckets (50-60, 60-70, 70-80, 80+)
  const confidenceBuckets = ['50-60', '60-70', '70-80', '80+'];
  const confidenceSegments: Record<string, BacktestMetrics> = {};
  confidenceBuckets.forEach(bucket => {
    const subset = predictions.filter(p => {
      const pct = p.probability * 100;
      if (bucket === '50-60') return pct >= 50 && pct < 60;
      if (bucket === '60-70') return pct >= 60 && pct < 70;
      if (bucket === '70-80') return pct >= 70 && pct < 80;
      return pct >= 80;
    });
    confidenceSegments[bucket] = runBacktest({ predictions: subset });
  });

  // 4. Segment by Competition (club, international)
  const competitions = ['club', 'international'];
  const competitionSegments: Record<string, BacktestMetrics> = {};
  competitions.forEach(c => {
    const subset = predictions.filter(p => (p.competitionType || 'club') === c);
    competitionSegments[c] = runBacktest({ predictions: subset });
  });

  return {
    overall,
    marketSegments,
    confidenceSegments,
    competitionSegments
  };
}
