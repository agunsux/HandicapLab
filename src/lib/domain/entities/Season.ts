/**
 * HandicapLab Domain-Driven Design — Season Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export interface Stage { name: string; startDate: string; endDate: string; }

export interface SeasonDTO {
  id: string;
  competitionId: string;
  label: string;
  startDate: string;
  endDate: string;
  currentMatchday: number;
  stages: Stage[];
}

export class Season {
  readonly id: string;
  readonly _competitionId: string;
  readonly _label: string;
  readonly _startDate: string;
  readonly _endDate: string;
  readonly _currentMatchday: number;
  readonly _stages: Stage[];

  private constructor(
    id: string,
    competitionId: string,
    label: string,
    startDate: string,
    endDate: string,
    currentMatchday: number,
    stages: Stage[]
  ) {
    this.id = id;
    this._competitionId = competitionId;
    this._label = label;
    this._startDate = startDate;
    this._endDate = endDate;
    this._currentMatchday = currentMatchday;
    this._stages = stages;
    Object.freeze(this);
  }

  static create(
    competitionId: string,
    label: string,
    startDate: string,
    endDate: string,
    currentMatchday: number,
    stages: Stage[]
  ): Season {
    const id = generateId(ID_PREFIX.SEASON);
    return new Season(id, competitionId, label, startDate, endDate, currentMatchday, stages);
  }

  static fromDTO(dto: SeasonDTO): Season {
    return new Season(dto.id, dto.competitionId, dto.label, dto.startDate, dto.endDate, dto.currentMatchday, dto.stages);
  }

  toDTO(): SeasonDTO {
    return {
      id: this.id,
      competitionId: this._competitionId,
      label: this._label,
      startDate: this._startDate,
      endDate: this._endDate,
      currentMatchday: this._currentMatchday,
      stages: this._stages
    };
  }

  get competitionId(): string { return this._competitionId; }
  get label(): string { return this._label; }
  get startDate(): string { return this._startDate; }
  get endDate(): string { return this._endDate; }
  get currentMatchday(): number { return this._currentMatchday; }
  get stages(): Stage[] { return this._stages; }

  equals(other: Season): boolean {
    return this.id === other.id &&
      this._competitionId === other._competitionId &&
      this._label === other._label &&
      this._startDate === other._startDate &&
      this._endDate === other._endDate &&
      this._currentMatchday === other._currentMatchday &&
      this._stages === other._stages;
  }

}
