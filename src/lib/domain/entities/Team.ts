/**
 * HandicapLab Domain-Driven Design — Team Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface TeamDTO {
  id: string;
  name: string;
  code: string;
  country: string;
  logo: string;
  venueName: string;
  founded: number;
}

export class Team {
  readonly id: string;
  readonly _name: string;
  readonly _code: string;
  readonly _country: string;
  readonly _logo: string;
  readonly _venueName: string;
  readonly _founded: number;

  private constructor(
    id: string,
    name: string,
    code: string,
    country: string,
    logo: string,
    venueName: string,
    founded: number
  ) {
    this.id = id;
    this._name = name;
    this._code = code;
    this._country = country;
    this._logo = logo;
    this._venueName = venueName;
    this._founded = founded;
    Object.freeze(this);
  }

  static create(
    name: string,
    code: string,
    country: string,
    logo: string,
    venueName: string,
    founded: number
  ): Team {
    const id = generateId(ID_PREFIX.TEAM);
    return new Team(id, name, code, country, logo, venueName, founded);
  }

  static fromDTO(dto: TeamDTO): Team {
    return new Team(dto.id, dto.name, dto.code, dto.country, dto.logo, dto.venueName, dto.founded);
  }

  toDTO(): TeamDTO {
    return {
      id: this.id,
      name: this._name,
      code: this._code,
      country: this._country,
      logo: this._logo,
      venueName: this._venueName,
      founded: this._founded
    };
  }

  get name(): string { return this._name; }
  get code(): string { return this._code; }
  get country(): string { return this._country; }
  get logo(): string { return this._logo; }
  get venueName(): string { return this._venueName; }
  get founded(): number { return this._founded; }

  equals(other: Team): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._code === other._code &&
      this._country === other._country &&
      this._logo === other._logo &&
      this._venueName === other._venueName &&
      this._founded === other._founded;
  }

}
