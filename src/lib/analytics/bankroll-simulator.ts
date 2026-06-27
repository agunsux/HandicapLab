export interface SimulationResult {
  ending_balance: number;
  profit: number;
  ROI: number;
  max_drawdown: number;
}

export interface SimSignal {
  status: string;
  odds: number;
  probability?: number;
}

/**
 * Simulates a bankroll over a series of resolved signals.
 * Supports flat and percentage stake strategies.
 * Calculates profit, ROI, and peak-to-trough max drawdown.
 */
export function simulateBankroll(
  signals: SimSignal[],
  initialBankroll = 1000,
  stakeStrategy: 'flat' | 'percentage' = 'flat',
  stakeValue = 10
): SimulationResult {
  let balance = initialBankroll;
  let peak = initialBankroll;
  let maxDrawdown = 0;
  let totalStake = 0;
  let totalProfit = 0;

  for (const sig of signals) {
    let stake = 0;
    if (stakeStrategy === 'flat') {
      stake = stakeValue;
    } else {
      // Percentage of current bankroll balance
      stake = balance * stakeValue;
    }

    // Guard against stake exceeding current balance
    if (stake > balance) {
      stake = balance;
    }
    if (stake <= 0) break;

    const odds = Number(sig.odds || 1.0);
    const status = (sig.status || '').toLowerCase();
    let profit = 0;

    if (status === 'won' || status === 'win') {
      profit = stake * (odds - 1.0);
    } else if (status === 'half_win') {
      profit = stake * 0.5 * (odds - 1.0);
    } else if (status === 'push' || status === 'void' || status === 'cancelled') {
      profit = 0.0;
    } else if (status === 'half_loss') {
      profit = -stake * 0.5;
    } else {
      // lost
      profit = -stake;
    }

    balance += profit;
    totalStake += stake;
    totalProfit += profit;

    if (balance > peak) {
      peak = balance;
    }
    const drawdown = peak > 0 ? (peak - balance) / peak : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0.0;

  return {
    ending_balance: Number(balance.toFixed(2)),
    profit: Number(totalProfit.toFixed(2)),
    ROI: Number(roi.toFixed(2)),
    max_drawdown: Number(maxDrawdown.toFixed(4))
  };
}
