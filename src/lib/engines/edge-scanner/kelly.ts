export class Kelly {
  /**
   * Computes fractional Kelly staking.
   * Kelly Stake = fraction * (EV / (marketOdds - 1))
   * Kelly output is a risk sizing metric only.
   * 
   * @param modelProbability Model probability of winning (0.0 to 1.0)
   * @param marketOdds Decimal market odds (e.g. 2.10)
   * @param fraction Staking multiplier fraction (default: 0.25)
   * @param maxStake Maximum allowed fraction of bankroll (default: 0.10, i.e. 10%)
   */
  public static calculateStake(
    modelProbability: number,
    marketOdds: number,
    fraction: number = 0.25,
    maxStake: number = 0.10
  ): number {
    if (marketOdds <= 1.0) return 0;
    const ev = modelProbability * marketOdds - 1;
    if (ev <= 0) return 0;

    const rawKelly = ev / (marketOdds - 1);
    const fractionalKelly = fraction * rawKelly;

    // Clamp between 0 and maxStake
    const clampedKelly = Math.max(0, Math.min(maxStake, fractionalKelly));
    return Number(clampedKelly.toFixed(4));
  }
}
