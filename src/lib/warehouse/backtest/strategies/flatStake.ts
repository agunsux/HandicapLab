import { IStakeStrategy, BacktestConfig } from '../interfaces';

export class FlatStake implements IStakeStrategy {
  private readonly flatAmount: number;

  constructor(flatAmount = 10.0) {
    this.flatAmount = flatAmount;
  }

  public getName(): string {
    return 'FLAT_STAKE';
  }

  public calculateStake(odds: number, probability: number, bankroll: number, config: BacktestConfig): number {
    // Return flat stake amount if bankroll is sufficient
    return bankroll >= this.flatAmount ? this.flatAmount : 0.0;
  }
}
