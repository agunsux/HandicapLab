/**
 * HandicapLab Domain-Driven Design — League Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface LeagueDTO {
  id: string;
  name: string;
  country: string;
  logo: string;
  status: string;
}

export class League {
  readonly id: string;
  readonly _name: string;
  readonly _country: string;
  readonly _logo: string;
  readonly _status: string;

  private constructor(
    id: string,
    name: string,
    country: string,
    logo: string,
    status: string
  ) {
    this.id = id;
    this._name = name;
    this._country = country;
    this._logo = logo;
    this._status = status;
    Object.freeze(this);
  }

  static create(
    name: string,
    country: string,
    logo: string,
    status: string
  ): League {
    const id = generateId(ID_PREFIX.LEAGUE);
    return new League(id, name, country, logo, status);
  }

  static fromDTO(dto: LeagueDTO): League {
    return new League(dto.id, dto.name, dto.country, dto.logo, dto.status);
  }

  toDTO(): LeagueDTO {
    return {
      id: this.id,
      name: this._name,
      country: this._country,
      logo: this._logo,
      status: this._status
    };
  }

  get name(): string { return this._name; }
  get country(): string { return this._country; }
  get logo(): string { return this._logo; }
  get status(): string { return this._status; }

  equals(other: League): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._country === other._country &&
      this._logo === other._logo &&
      this._status === other._status;
  }

}
