/**
 * HandicapLab Domain-Driven Design — Result Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ResultStatus = 'finished' | 'awarded' | 'abandoned' | 'postponed';
export type MatchWinner = 'home' | 'away' | 'draw';

export interface ResultDTO {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  homeHalfScore?: number;
  awayHalfScore?: number;
  status: ResultStatus;
  winner?: MatchWinner;
  matchDuration?: number;
  collectedAt: string
}

export class Result {
  readonly id: string;
  readonly _fixtureId: string;
  readonly _homeScore: number;
  readonly _awayScore: number;
  readonly _homeHalfScore: number;
  readonly _awayHalfScore: number;
  readonly _status: ResultStatus;
  readonly _winner: MatchWinner;
  readonly _matchDuration: number;
  readonly _collectedAt: string;

  private constructor(
    id: string,
    fixtureId: string,
    homeScore: number,
    awayScore: number,
    homeHalfScore?: number,
    awayHalfScore?: number,
    status: ResultStatus,
    winner?: MatchWinner,
    matchDuration?: number,
    collectedAt: string
  ) {
    this.id = id;
    this._fixtureId = fixtureId;
    this._homeScore = homeScore;
    this._awayScore = awayScore;
    this._homeHalfScore = homeHalfScore;
    this._awayHalfScore = awayHalfScore;
    this._status = status;
    this._winner = winner;
    this._matchDuration = matchDuration;
    this._collectedAt = collectedAt;
    Object.freeze(this);
  }

  static create(
    fixtureId: string,
    homeScore: number,
    awayScore: number,
    homeHalfScore?: number,
    awayHalfScore?: number,
    status: ResultStatus,
    winner?: MatchWinner,
    matchDuration?: number,
    collectedAt: string
  ): Result {
    const id = generateId(ID_PREFIX.RESULT);
    return new Result(id, fixtureId, homeScore, awayScore, homeHalfScore, awayHalfScore, status, winner, matchDuration, collectedAt);
  }

  static fromDTO(dto: ResultDTO): Result {
    return new Result(dto.id, dto.fixtureId, dto.homeScore, dto.awayScore, dto.homeHalfScore, dto.awayHalfScore, dto.status, dto.winner, dto.matchDuration, dto.collectedAt);
  }

  toDTO(): ResultDTO {
    return {
      id: this.id,
      fixtureId: this._fixtureId,
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      homeHalfScore: this._homeHalfScore,
      awayHalfScore: this._awayHalfScore,
      status: this._status,
      winner: this._winner,
      matchDuration: this._matchDuration,
      collectedAt: this._collectedAt
    };
  }

  equals(other: Result): boolean {
    return this.id === other.id &&
      this._fixtureId === other._fixtureId &&
      this._homeScore === other._homeScore &&
      this._awayScore === other._awayScore &&
      this._homeHalfScore === other._homeHalfScore &&
      this._awayHalfScore === other._awayHalfScore &&
      this._status === other._status &&
      this._winner === other._winner &&
      this._matchDuration === other._matchDuration &&
      this._collectedAt === other._collectedAt;
  }

}
