/**
 * HandicapLab Domain-Driven Design — Market Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface MarketDTO {
  id: string;
  name: string;
  marketType: string;
  description: string;
  status: string;
}

export class Market {
  readonly id: string;
  readonly _name: string;
  readonly _marketType: string;
  readonly _description: string;
  readonly _status: string;

  private constructor(
    id: string,
    name: string,
    marketType: string,
    description: string,
    status: string
  ) {
    this.id = id;
    this._name = name;
    this._marketType = marketType;
    this._description = description;
    this._status = status;
    Object.freeze(this);
  }

  static create(
    name: string,
    marketType: string,
    description: string,
    status: string
  ): Market {
    const id = generateId(ID_PREFIX.MARKET);
    return new Market(id, name, marketType, description, status);
  }

  static fromDTO(dto: MarketDTO): Market {
    return new Market(dto.id, dto.name, dto.marketType, dto.description, dto.status);
  }

  toDTO(): MarketDTO {
    return {
      id: this.id,
      name: this._name,
      marketType: this._marketType,
      description: this._description,
      status: this._status
    };
  }

  get name(): string { return this._name; }
  get marketType(): string { return this._marketType; }
  get description(): string { return this._description; }
  get status(): string { return this._status; }

  equals(other: Market): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._marketType === other._marketType &&
      this._description === other._description &&
      this._status === other._status;
  }

}
