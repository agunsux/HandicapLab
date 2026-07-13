/**
 * HandicapLab Domain-Driven Design — Competition Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type CompetitionStatus = 'ACTIVE' | 'INACTIVE' | 'UPCOMING' | 'COMPLETED' | 'active' | 'inactive' | 'upcoming' | 'completed';
export type CompetitionSport = 'FOOTBALL' | 'BASKETBALL' | 'TENNIS' | 'OTHER' | 'Football' | 'Basketball' | 'Tennis' | 'Other';

export interface CompetitionDTO {
  id: string;
  name: string;
  country: string;
  sport: CompetitionSport;
  tier: number;
  startDate: string;
  endDate: string;
  status: CompetitionStatus;
}

export class Competition {
  readonly id: string;
  readonly _name: string;
  readonly _country: string;
  readonly _sport: CompetitionSport;
  readonly _tier: number;
  readonly _startDate: string;
  readonly _endDate: string;
  readonly _status: CompetitionStatus;

  private constructor(
    id: string,
    name: string,
    country: string,
    sport: CompetitionSport,
    tier: number,
    startDate: string,
    endDate: string,
    status: CompetitionStatus
  ) {
    this.id = id;
    this._name = name;
    this._country = country;
    this._sport = sport;
    this._tier = tier;
    this._startDate = startDate;
    this._endDate = endDate;
    this._status = status;
    Object.freeze(this);
  }

  static create(
    name: string,
    country: string,
    sport: CompetitionSport,
    tier: number,
    startDate: string,
    endDate: string,
    status: CompetitionStatus
  ): Competition {
    const id = generateId(ID_PREFIX.COMPETITION);
    return new Competition(id, name, country, sport, tier, startDate, endDate, status);
  }

  static fromDTO(dto: CompetitionDTO): Competition {
    return new Competition(dto.id, dto.name, dto.country, dto.sport, dto.tier, dto.startDate, dto.endDate, dto.status);
  }

  toDTO(): CompetitionDTO {
    return {
      id: this.id,
      name: this._name,
      country: this._country,
      sport: this._sport,
      tier: this._tier,
      startDate: this._startDate,
      endDate: this._endDate,
      status: this._status
    };
  }

  get name(): string { return this._name; }
  get country(): string { return this._country; }
  get sport(): CompetitionSport { return this._sport; }
  get tier(): number { return this._tier; }
  get startDate(): string { return this._startDate; }
  get endDate(): string { return this._endDate; }
  get status(): CompetitionStatus { return this._status; }

  equals(other: Competition): boolean {
    return this.id === other.id &&
      this._name === other._name &&
      this._country === other._country &&
      this._sport === other._sport &&
      this._tier === other._tier &&
      this._startDate === other._startDate &&
      this._endDate === other._endDate &&
      this._status === other._status;
  }

}
