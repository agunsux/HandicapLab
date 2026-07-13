/**
 * HandicapLab Domain-Driven Design — Fixture Entity
 */
import { generateId, ID_PREFIX } from '../shared/Identifier';



export interface FixtureDTO {
  id: string;
  leagueId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string;
  kickoffTime: string;
  status: string;
  round: string;
  matchday: number;
  homeScore?: number | null;
  awayScore?: number | null;
}

export class Fixture {
  readonly id: string;
  readonly _leagueId: string;
  readonly _seasonId: string;
  readonly _homeTeamId: string;
  readonly _awayTeamId: string;
  readonly _venueId: string;
  readonly _kickoffTime: string;
  readonly _status: string;
  readonly _round: string;
  readonly _matchday: number;
  readonly _homeScore?: number | null;
  readonly _awayScore?: number | null;

  private constructor(
    id: string,
    leagueId: string,
    seasonId: string,
    homeTeamId: string,
    awayTeamId: string,
    venueId: string,
    kickoffTime: string,
    status: string,
    round: string,
    matchday: number,
    homeScore?: number | null,
    awayScore?: number | null
  ) {
    this.id = id;
    this._leagueId = leagueId;
    this._seasonId = seasonId;
    this._homeTeamId = homeTeamId;
    this._awayTeamId = awayTeamId;
    this._venueId = venueId;
    this._kickoffTime = kickoffTime;
    this._status = status;
    this._round = round;
    this._matchday = matchday;
    this._homeScore = homeScore;
    this._awayScore = awayScore;
    Object.freeze(this);
  }

  static create(
    leagueId: string,
    seasonId: string,
    homeTeamId: string,
    awayTeamId: string,
    venueId: string,
    kickoffTime: string,
    status: string,
    round: string,
    matchday: number,
    homeScore?: number | null,
    awayScore?: number | null
  ): Fixture {
    const id = generateId(ID_PREFIX.FIXTURE);
    return new Fixture(id, leagueId, seasonId, homeTeamId, awayTeamId, venueId, kickoffTime, status, round, matchday, homeScore, awayScore);
  }

  static fromDTO(dto: FixtureDTO): Fixture {
    return new Fixture(dto.id, dto.leagueId, dto.seasonId, dto.homeTeamId, dto.awayTeamId, dto.venueId, dto.kickoffTime, dto.status, dto.round, dto.matchday, dto.homeScore, dto.awayScore);
  }

  toDTO(): FixtureDTO {
    return {
      id: this.id,
      leagueId: this._leagueId,
      seasonId: this._seasonId,
      homeTeamId: this._homeTeamId,
      awayTeamId: this._awayTeamId,
      venueId: this._venueId,
      kickoffTime: this._kickoffTime,
      status: this._status,
      round: this._round,
      matchday: this._matchday,
      homeScore: this._homeScore,
      awayScore: this._awayScore
    };
  }

  get leagueId(): string { return this._leagueId; }
  get seasonId(): string { return this._seasonId; }
  get homeTeamId(): string { return this._homeTeamId; }
  get awayTeamId(): string { return this._awayTeamId; }
  get venueId(): string { return this._venueId; }
  get kickoffTime(): string { return this._kickoffTime; }
  get status(): string { return this._status; }
  get round(): string { return this._round; }
  get matchday(): number { return this._matchday; }
  get homeScore(): number | null | undefined { return this._homeScore; }
  get awayScore(): number | null | undefined { return this._awayScore; }

  equals(other: Fixture): boolean {
    return this.id === other.id &&
      this._leagueId === other._leagueId &&
      this._seasonId === other._seasonId &&
      this._homeTeamId === other._homeTeamId &&
      this._awayTeamId === other._awayTeamId &&
      this._venueId === other._venueId &&
      this._kickoffTime === other._kickoffTime &&
      this._status === other._status &&
      this._round === other._round &&
      this._matchday === other._matchday &&
      this._homeScore === other._homeScore &&
      this._awayScore === other._awayScore;
  }

}
