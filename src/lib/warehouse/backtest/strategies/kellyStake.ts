import { IStakeStrategy, BacktestConfig } from '../interfaces';

export class KellyStake implements IStakeStrategy {
  public getName(): string {
    return 'KELLY_STAKE';
  }

  public calculateStake(odds: number, probability: number, bankroll: number, config: BacktestConfig): number {
    if (odds <= 1.0 || probability <= 0.0) return 0.0;

    const b = odds - 1;
    const q = 1 - probability;
    
    // Kelly Formula: f = (p*b - q) / b
    const rawFraction = (probability * b - q) / b;
    const boundedFraction = Math.max(0, rawFraction);
    
    const finalStake = boundedFraction * config.kellyFraction * bankroll;
    return Number(finalStake.toFixed(2));
  }
}
