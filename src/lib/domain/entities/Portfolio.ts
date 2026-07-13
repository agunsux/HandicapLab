/**
 * HandicapLab Domain-Driven Design — Portfolio Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export interface StakeAllocation { stakeId: string; fraction: number; currentValue: number; }

export interface PortfolioDTO {
  id: string;
  name: string;
  totalValue: number;
  cashBalance: number;
  allocations: StakeAllocation[];
  riskLimit: number;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export class Portfolio {
  readonly id: string;
  readonly _name: string;
  readonly _totalValue: number;
  readonly _cashBalance: number;
  readonly _allocations: StakeAllocation[];
  readonly _riskLimit: number;
  readonly _createdAt: string;
  readonly _updatedAt: string;
  readonly _description?: string;

  private constructor(
    id: string,
    name: string,
    totalValue: number,
    cashBalance: number,
    allocations: StakeAllocation[],
    riskLimit: number,
    createdAt: string,
    updatedAt: string,
    description?: string
  ) {
    this.id = id;
    this._name = name;
    this._totalValue = totalValue;
    this._cashBalance = cashBalance;
    this._allocations = allocations;
    this._riskLimit = riskLimit;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._description = description;
    Object.freeze(this);
  }

  static create(
    name: string,
    totalValue: number,
    cashBalance: number,
    allocations: StakeAllocation[],
    riskLimit: number,
    createdAt: string,
    updatedAt: string,
    description?: string
  ): Portfolio {
    const id = generateId(ID_PREFIX.PORTFOLIO);
    return new Portfolio(id, name, totalValue, cashBalance, allocations, riskLimit, createdAt, updatedAt, description);
  }

  static fromDTO(dto: PortfolioDTO): Portfolio {
    return new Portfolio(dto.id, dto.name, dto.totalValue, dto.cashBalance, dto.allocations, dto.riskLimit, dto.createdAt, dto.updatedAt, dto.description);
  }

  toDTO(): PortfolioDTO {
    return {
      id: this.id,
      name: this._name,
      totalValue: this._totalValue,
      cashBalance: this._cashBalance,
      allocations: this._allocations,
      riskLimit: this._riskLimit,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      description: this._description
    };
  }

  get name(): string { return this._name; }
  get totalValue(): number { return this._totalValue; }
  get cashBalance(): number { return this._cashBalance; }
  get allocations(): StakeAllocation[] { return this._allocations; }
  get riskLimit(): number { return this._riskLimit; }
  get createdAt(): string { return this._createdAt; }
  get updatedAt(): string { return this._updatedAt; }
  get description(): string | undefined { return this._description; }

  equals(other: Portfolio): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._totalValue === other._totalValue &&
      this._cashBalance === other._cashBalance &&
      this._allocations === other._allocations &&
      this._riskLimit === other._riskLimit &&
      this._createdAt === other._createdAt &&
      this._updatedAt === other._updatedAt &&
      this._description === other._description;
  }

}
