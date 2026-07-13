/**
 * HandicapLab Domain-Driven Design — Player Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface PlayerDTO {
  id: string;
  name: string;
  position: string;
  nationality: string;
  birthDate?: string;
  height?: string;
  weight?: string;
}

export class Player {
  readonly id: string;
  readonly _name: string;
  readonly _position: string;
  readonly _nationality: string;
  readonly _birthDate?: string;
  readonly _height?: string;
  readonly _weight?: string;

  private constructor(
    id: string,
    name: string,
    position: string,
    nationality: string,
    birthDate?: string,
    height?: string,
    weight?: string
  ) {
    this.id = id;
    this._name = name;
    this._position = position;
    this._nationality = nationality;
    this._birthDate = birthDate;
    this._height = height;
    this._weight = weight;
    Object.freeze(this);
  }

  static create(
    name: string,
    position: string,
    nationality: string,
    birthDate?: string,
    height?: string,
    weight?: string
  ): Player {
    const id = generateId(ID_PREFIX.PLAYER);
    return new Player(id, name, position, nationality, birthDate, height, weight);
  }

  static fromDTO(dto: PlayerDTO): Player {
    return new Player(dto.id, dto.name, dto.position, dto.nationality, dto.birthDate, dto.height, dto.weight);
  }

  toDTO(): PlayerDTO {
    return {
      id: this.id,
      name: this._name,
      position: this._position,
      nationality: this._nationality,
      birthDate: this._birthDate,
      height: this._height,
      weight: this._weight
    };
  }

  get name(): string { return this._name; }
  get position(): string { return this._position; }
  get nationality(): string { return this._nationality; }
  get birthDate(): string | undefined { return this._birthDate; }
  get height(): string | undefined { return this._height; }
  get weight(): string | undefined { return this._weight; }

  equals(other: Player): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._position === other._position &&
      this._nationality === other._nationality &&
      this._birthDate === other._birthDate &&
      this._height === other._height &&
      this._weight === other._weight;
  }

}
