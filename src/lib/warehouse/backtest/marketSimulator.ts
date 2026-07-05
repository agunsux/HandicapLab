export interface ExecutionResult {
  executedOdds: number;
  executedStake: number;
  status: 'EXECUTED' | 'REJECTED_SUSPENDED' | 'REJECTED_EXPOSURE';
}

export class MarketSimulator {
  private readonly liquidityLimit = 1000.0; // Max stake capacity in currency units
  private readonly maxExposureLimit = 5000.0; // Maximum bookmaker liability exposure

  /**
   * Simulates execution under real market conditions.
   * Enforces partial fills, slippage, latency delay, and suspended markets.
   */
  public simulateExecution(
    odds: number,
    stake: number,
    isSuspended = false,
    randomSeed = 42,
    latencyMs = 150
  ): ExecutionResult {
    if (isSuspended) {
      return { executedOdds: 0, executedStake: 0, status: 'REJECTED_SUSPENDED' };
    }

    // Limit maximum exposure liability: odds * stake cannot exceed limit
    if (stake * odds > this.maxExposureLimit) {
      return { executedOdds: 0, executedStake: 0, status: 'REJECTED_EXPOSURE' };
    }

    // Partial fill: cap stake at liquidity limit
    const executedStake = Math.min(stake, this.liquidityLimit);

    // Deterministic random generation for slippage based on seed and latency delay
    const seedWithLatency = randomSeed + latencyMs;
    const pseudoRandom = Math.sin(seedWithLatency) * 10000 - Math.floor(Math.sin(seedWithLatency) * 10000);
    
    // Slippage: odds update right before placement
    const slippage = (pseudoRandom - 0.5) * 0.08; // Up to 4% slippage
    const executedOdds = Number(Math.max(1.01, odds + slippage).toFixed(2));

    return {
      executedOdds,
      executedStake,
      status: 'EXECUTED'
    };
  }
}
