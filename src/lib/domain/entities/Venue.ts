/**
 * HandicapLab Domain-Driven Design — Venue Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface VenueDTO {
  id: string;
  name: string;
  city: string;
  capacity?: number;
  surface?: string;
  address?: string;
}

export class Venue {
  readonly id: string;
  readonly _name: string;
  readonly _city: string;
  readonly _capacity?: number;
  readonly _surface?: string;
  readonly _address?: string;

  private constructor(
    id: string,
    name: string,
    city: string,
    capacity?: number,
    surface?: string,
    address?: string
  ) {
    this.id = id;
    this._name = name;
    this._city = city;
    this._capacity = capacity;
    this._surface = surface;
    this._address = address;
    Object.freeze(this);
  }

  static create(
    name: string,
    city: string,
    capacity?: number,
    surface?: string,
    address?: string
  ): Venue {
    const id = generateId(ID_PREFIX.VENUE);
    return new Venue(id, name, city, capacity, surface, address);
  }

  static fromDTO(dto: VenueDTO): Venue {
    return new Venue(dto.id, dto.name, dto.city, dto.capacity, dto.surface, dto.address);
  }

  toDTO(): VenueDTO {
    return {
      id: this.id,
      name: this._name,
      city: this._city,
      capacity: this._capacity,
      surface: this._surface,
      address: this._address
    };
  }

  get name(): string { return this._name; }
  get city(): string { return this._city; }
  get capacity(): number | undefined { return this._capacity; }
  get surface(): string | undefined { return this._surface; }
  get address(): string | undefined { return this._address; }

  equals(other: Venue): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._city === other._city &&
      this._capacity === other._capacity &&
      this._surface === other._surface &&
      this._address === other._address;
  }

}
