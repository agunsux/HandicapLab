/**
 * HandicapLab Domain-Driven Design — Portfolio Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export interface StakeAllocation { stakeId: string; fraction: number; currentValue: number; }

export interface PortfolioDTO {
  name: string;
  description?: string;
  totalValue: number;
  cashBalance: number;
  allocations: StakeAllocation[];
  riskLimit: number;
  createdAt: string;
  updatedAt: string
}

export class Portfolio {
  readonly id: string;
  readonly _name: string;
  readonly _description: string;
  readonly _totalValue: number;
  readonly _cashBalance: number;
  readonly _allocations: StakeAllocation[];
  readonly _riskLimit: number;
  readonly _createdAt: string;
  readonly _updatedAt: string;

  private constructor(
    id: string,
    name: string,
    description?: string,
    totalValue: number,
    cashBalance: number,
    allocations: StakeAllocation[],
    riskLimit: number,
    createdAt: string,
    updatedAt: string
  ) {
    this.id = id;
    this._name = name;
    this._description = description;
    this._totalValue = totalValue;
    this._cashBalance = cashBalance;
    this._allocations = allocations;
    this._riskLimit = riskLimit;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    Object.freeze(this);
  }

  static create(
    name: string,
    description?: string,
    totalValue: number,
    cashBalance: number,
    allocations: StakeAllocation[],
    riskLimit: number,
    createdAt: string,
    updatedAt: string
  ): Portfolio {
    const id = generateId(ID_PREFIX.PORTFOLIO);
    return new Portfolio(id, name, description, totalValue, cashBalance, allocations, riskLimit, createdAt, updatedAt);
  }

  static fromDTO(dto: PortfolioDTO): Portfolio {
    return new Portfolio(dto.id, dto.name, dto.description, dto.totalValue, dto.cashBalance, dto.allocations, dto.riskLimit, dto.createdAt, dto.updatedAt);
  }

  toDTO(): PortfolioDTO {
    return {
      id: this.id,
      name: this._name,
      description: this._description,
      totalValue: this._totalValue,
      cashBalance: this._cashBalance,
      allocations: this._allocations,
      riskLimit: this._riskLimit,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }

  equals(other: Portfolio): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._description === other._description &&
      this._totalValue === other._totalValue &&
      this._cashBalance === other._cashBalance &&
      this._allocations === other._allocations &&
      this._riskLimit === other._riskLimit &&
      this._createdAt === other._createdAt &&
      this._updatedAt === other._updatedAt;
  }

}
