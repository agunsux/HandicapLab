/**
 * HandicapLab Domain-Driven Design — Result Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';

export type ResultStatus = 'finished' | 'awarded' | 'abandoned' | 'postponed';
export type MatchWinner = 'home' | 'away' | 'draw';

export interface ResultDTO {
  id: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  status: ResultStatus;
  collectedAt: string;
  homeHalfScore?: number;
  awayHalfScore?: number;
  winner?: MatchWinner;
  matchDuration?: number;
}

export class Result {
  readonly id: string;
  readonly _fixtureId: string;
  readonly _homeScore: number;
  readonly _awayScore: number;
  readonly _status: ResultStatus;
  readonly _collectedAt: string;
  readonly _homeHalfScore?: number;
  readonly _awayHalfScore?: number;
  readonly _winner?: MatchWinner;
  readonly _matchDuration?: number;

  private constructor(
    id: string,
    fixtureId: string,
    homeScore: number,
    awayScore: number,
    status: ResultStatus,
    collectedAt: string,
    homeHalfScore?: number,
    awayHalfScore?: number,
    winner?: MatchWinner,
    matchDuration?: number
  ) {
    this.id = id;
    this._fixtureId = fixtureId;
    this._homeScore = homeScore;
    this._awayScore = awayScore;
    this._status = status;
    this._collectedAt = collectedAt;
    this._homeHalfScore = homeHalfScore;
    this._awayHalfScore = awayHalfScore;
    this._winner = winner;
    this._matchDuration = matchDuration;
    Object.freeze(this);
  }

  static create(
    fixtureId: string,
    homeScore: number,
    awayScore: number,
    status: ResultStatus,
    collectedAt: string,
    homeHalfScore?: number,
    awayHalfScore?: number,
    winner?: MatchWinner,
    matchDuration?: number
  ): Result {
    const id = generateId(ID_PREFIX.RESULT);
    return new Result(id, fixtureId, homeScore, awayScore, status, collectedAt, homeHalfScore, awayHalfScore, winner, matchDuration);
  }

  static fromDTO(dto: ResultDTO): Result {
    return new Result(dto.id, dto.fixtureId, dto.homeScore, dto.awayScore, dto.status, dto.collectedAt, dto.homeHalfScore, dto.awayHalfScore, dto.winner, dto.matchDuration);
  }

  toDTO(): ResultDTO {
    return {
      id: this.id,
      fixtureId: this._fixtureId,
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      status: this._status,
      collectedAt: this._collectedAt,
      homeHalfScore: this._homeHalfScore,
      awayHalfScore: this._awayHalfScore,
      winner: this._winner,
      matchDuration: this._matchDuration
    };
  }

  get fixtureId(): string { return this._fixtureId; }
  get homeScore(): number { return this._homeScore; }
  get awayScore(): number { return this._awayScore; }
  get status(): ResultStatus { return this._status; }
  get collectedAt(): string { return this._collectedAt; }
  get homeHalfScore(): number | undefined { return this._homeHalfScore; }
  get awayHalfScore(): number | undefined { return this._awayHalfScore; }
  get winner(): MatchWinner | undefined { return this._winner; }
  get matchDuration(): number | undefined { return this._matchDuration; }

  equals(other: Result): boolean {
    return this.id === other.id &&
      this._fixtureId === other._fixtureId &&
      this._homeScore === other._homeScore &&
      this._awayScore === other._awayScore &&
      this._status === other._status &&
      this._collectedAt === other._collectedAt &&
      this._homeHalfScore === other._homeHalfScore &&
      this._awayHalfScore === other._awayHalfScore &&
      this._winner === other._winner &&
      this._matchDuration === other._matchDuration;
  }

}
