// Monte Carlo Simulation Engine
// Location: src/lib/engine/monte-carlo.ts

export interface MonteCarloInput {
  bets: {
    probability: number;
    odds: number;
    weight: number; // weight of bankroll, e.g. 0.02 (2%)
  }[];
  initialBankroll: number;
  numPaths?: number;
}

export interface MonteCarloReport {
  expectedReturnPercent: number;
  expectedVariance: number;
  maxDrawdownEstimate: number; // 95th percentile worst drawdown
  ruinProbability: number;     // bankroll <= 10% of initial
  finalValueMean: number;
  var95Percent: number;         // 95% Value at Risk
}

export class MonteCarloEngine {
  /**
   * Runs N paths of portfolio return simulation.
   */
  public static simulate(input: MonteCarloInput): MonteCarloReport {
    const { bets, initialBankroll, numPaths = 10000 } = input;

    if (bets.length === 0) {
      return {
        expectedReturnPercent: 0.0,
        expectedVariance: 0.0,
        maxDrawdownEstimate: 0.0,
        ruinProbability: 0.0,
        finalValueMean: initialBankroll,
        var95Percent: 0.0
      };
    }

    const finalValues: number[] = [];
    const drawdowns: number[] = [];
    let ruinCount = 0;

    for (let path = 0; path < numPaths; path++) {
      let bankroll = initialBankroll;
      let peak = initialBankroll;
      let maxDD = 0.0;
      let pathRuin = false;

      // Simulate outcomes for the portfolio batch
      for (const bet of bets) {
        // Random outcome based on probability
        const win = Math.random() < bet.probability;
        const stake = bankroll * bet.weight;

        if (win) {
          bankroll += stake * (bet.odds - 1.0);
        } else {
          bankroll -= stake;
        }

        // Track ruin (drops below 10% of initial bankroll)
        if (bankroll <= initialBankroll * 0.1) {
          pathRuin = true;
        }

        // Track drawdowns
        if (bankroll > peak) {
          peak = bankroll;
        }
        const dd = (peak - bankroll) / peak;
        if (dd > maxDD) {
          maxDD = dd;
        }
      }

      finalValues.push(bankroll);
      drawdowns.push(maxDD);
      if (pathRuin) ruinCount++;
    }

    // Sort to extract percentiles
    finalValues.sort((a, b) => a - b);
    drawdowns.sort((a, b) => a - b);

    const meanFinalValue = finalValues.reduce((sum, v) => sum + v, 0) / numPaths;
    const expectedReturn = ((meanFinalValue - initialBankroll) / initialBankroll) * 100;

    // Calculate Variance
    const variance =
      finalValues.reduce((sum, v) => sum + Math.pow(v - meanFinalValue, 2), 0) /
      (numPaths * initialBankroll * initialBankroll);

    // Ruin probability
    const ruinProbability = ruinCount / numPaths;

    // 95% worst drawdown (95th percentile)
    const idx95 = Math.floor(numPaths * 0.95);
    const maxDrawdownEstimate = drawdowns[idx95];

    // Value at Risk (VaR) at 95% confidence level
    // VaR = initialBankroll - 5th percentile final value
    const idx5 = Math.floor(numPaths * 0.05);
    const valueAtRisk = Math.max(0.0, initialBankroll - finalValues[idx5]);

    return {
      expectedReturnPercent: Number(expectedReturn.toFixed(4)),
      expectedVariance: Number(variance.toFixed(6)),
      maxDrawdownEstimate: Number(maxDrawdownEstimate.toFixed(4)),
      ruinProbability: Number(ruinProbability.toFixed(4)),
      finalValueMean: Number(meanFinalValue.toFixed(2)),
      var95Percent: Number((valueAtRisk / initialBankroll).toFixed(4))
    };
  }
}
