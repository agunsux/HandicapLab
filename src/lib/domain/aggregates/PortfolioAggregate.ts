import { AggregateRoot } from './AggregateRoot';

export interface PortfolioAllocation { stakeId: string; amount: number; fraction: number; }

export class PortfolioAggregate extends AggregateRoot {
  private _cashBalance: number;
  private _totalValue: number;
  private _allocations: PortfolioAllocation[] = [];
  private _riskLimit: number;

  constructor(id: string, initialBalance: number, riskLimit: number) {
    super(id); this._cashBalance = initialBalance; this._totalValue = initialBalance; this._riskLimit = riskLimit;
  }

  get cashBalance(): number { return this._cashBalance; }
  get totalValue(): number { return this._totalValue; }
  get allocations(): PortfolioAllocation[] { return [...this._allocations]; }

  allocate(stakeId: string, amount: number): void {
    if (amount > this._cashBalance) throw new Error('Insufficient balance: ' + amount + ' > ' + this._cashBalance);
    const totalAllocated = this._allocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated + amount > this._riskLimit) throw new Error('Risk limit exceeded');
    this._cashBalance -= amount;
    this._allocations.push({ stakeId, amount, fraction: amount / this._totalValue });
  }

  settleStake(stakeId: string, pnl: number): void {
    const idx = this._allocations.findIndex(a => a.stakeId === stakeId);
    if (idx === -1) throw new Error('Stake not found: ' + stakeId);
    this._cashBalance += this._allocations[idx].amount + pnl;
    this._allocations.splice(idx, 1);
    this._totalValue += pnl;
  }

  rebalance(): void {
    for (const a of this._allocations) { a.fraction = a.amount / this._totalValue; }
  }

  riskCheck(): { passed: boolean; totalRisk: number; limit: number } {
    const totalRisk = this._allocations.reduce((sum, a) => sum + a.amount, 0);
    return { passed: totalRisk <= this._riskLimit, totalRisk, limit: this._riskLimit };
  }

  validate(): boolean { return this._cashBalance >= 0 && this._totalValue >= 0; }
}
