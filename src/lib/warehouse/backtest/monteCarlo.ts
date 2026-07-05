export interface MonteCarloSummary {
  expectedRoiMean: number;
  maxDrawdownMean: number;
  confidenceIntervalRoi: { lower: number; upper: number };
  confidenceIntervalDrawdown: { lower: number; upper: number };
}

export class MonteCarloSimulator {
  /**
   * Performs Monte Carlo reshuffling (bootstrapping) over completed trades.
   * Compares tail risk and confidence intervals on drawdown & ROI returns.
   */
  public static simulate(
    stakes: number[],
    returns: number[],
    iterations = 1000,
    randomSeed = 42
  ): MonteCarloSummary {
    const total = stakes.length;
    if (total === 0) {
      return { expectedRoiMean: 0, maxDrawdownMean: 0, confidenceIntervalRoi: { lower: 0, upper: 0 }, confidenceIntervalDrawdown: { lower: 0, upper: 0 } };
    }

    const roiRuns: number[] = [];
    const drawdownRuns: number[] = [];

    // Deterministic random generator based on input seed
    let seed = randomSeed;
    const nextRandom = () => {
      seed = Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000);
      return seed;
    };

    for (let run = 0; run < iterations; run++) {
      let currentBankroll = 1000.0;
      let peak = currentBankroll;
      let maxDrawdown = 0.0;

      let runStaked = 0;
      let runReturned = 0;

      // Reshuffle indices deterministic-randomly
      for (let i = 0; i < total; i++) {
        const randIdx = Math.floor(nextRandom() * total);
        const stake = stakes[randIdx];
        const betReturn = returns[randIdx];

        runStaked += stake;
        runReturned += betReturn;

        currentBankroll += (betReturn - stake);
        if (currentBankroll > peak) peak = currentBankroll;
        const dd = ((peak - currentBankroll) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      const runRoi = ((runReturned - runStaked) / runStaked) * 100;
      roiRuns.push(runRoi);
      drawdownRuns.push(maxDrawdown);
    }

    // Compute average statistics and 95% confidence intervals
    roiRuns.sort((a, b) => a - b);
    drawdownRuns.sort((a, b) => a - b);

    const sumRoi = roiRuns.reduce((a, b) => a + b, 0);
    const sumDrawdown = drawdownRuns.reduce((a, b) => a + b, 0);

    const lowerIdx = Math.floor(iterations * 0.025);
    const upperIdx = Math.floor(iterations * 0.975);

    return {
      expectedRoiMean: Number((sumRoi / iterations).toFixed(2)),
      maxDrawdownMean: Number((sumDrawdown / iterations).toFixed(2)),
      confidenceIntervalRoi: {
        lower: Number(roiRuns[lowerIdx].toFixed(2)),
        upper: Number(roiRuns[upperIdx].toFixed(2))
      },
      confidenceIntervalDrawdown: {
        lower: Number(drawdownRuns[lowerIdx].toFixed(2)),
        upper: Number(drawdownRuns[upperIdx].toFixed(2))
      }
    };
  }
}
