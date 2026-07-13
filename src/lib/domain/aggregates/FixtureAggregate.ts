import { AggregateRoot } from './AggregateRoot';
import { FixtureCreatedEvent, FixtureUpdatedEvent } from '../events/FixtureEvents';

export enum FixtureStatus { SCHEDULED = 'SCHEDULED', LIVE = 'LIVE', FINISHED = 'FINISHED', POSTPONED = 'POSTPONED', CANCELLED = 'CANCELLED' }

export class FixtureAggregate extends AggregateRoot {
  private _status: FixtureStatus = FixtureStatus.SCHEDULED;
  private _homeScore: number = 0;
  private _awayScore: number = 0;
  private _homeTeamId: string;
  private _awayTeamId: string;

  constructor(id: string, homeTeamId: string, awayTeamId: string) {
    super(id);
    this._homeTeamId = homeTeamId;
    this._awayTeamId = awayTeamId;
  }

  get status(): FixtureStatus { return this._status; }
  get homeScore(): number { return this._homeScore; }
  get awayScore(): number { return this._awayScore; }

  schedule(homeTeamId: string, awayTeamId: string, kickoffTime: string, leagueId: string): void {
    if (this._status !== FixtureStatus.SCHEDULED) throw new Error('Fixture already scheduled');
    this._homeTeamId = homeTeamId;
    this._awayTeamId = awayTeamId;
    this.addDomainEvent(FixtureCreatedEvent.create(this.id, homeTeamId, awayTeamId, kickoffTime, leagueId));
  }

  startMatch(): void {
    if (this._status !== FixtureStatus.SCHEDULED) throw new Error('Cannot start match from status ' + this._status);
    this._status = FixtureStatus.LIVE;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.LIVE }));
  }

  finish(homeScore: number, awayScore: number): void {
    if (this._status !== FixtureStatus.LIVE) throw new Error('Cannot finish match from status ' + this._status);
    if (homeScore < 0 || awayScore < 0) throw new Error('Scores cannot be negative');
    this._homeScore = homeScore; this._awayScore = awayScore;
    this._status = FixtureStatus.FINISHED;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.FINISHED, homeScore, awayScore }));
  }

  postpone(): void {
    if (this._status !== FixtureStatus.SCHEDULED && this._status !== FixtureStatus.LIVE) throw new Error('Cannot postpone from status ' + this._status);
    this._status = FixtureStatus.POSTPONED;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.POSTPONED }));
  }

  cancel(): void {
    if (this._status === FixtureStatus.FINISHED) throw new Error('Cannot cancel finished match');
    this._status = FixtureStatus.CANCELLED;
    this.addDomainEvent(FixtureUpdatedEvent.create(this.id, { status: FixtureStatus.CANCELLED }));
  }

  validate(): boolean {
    if (this._status === FixtureStatus.FINISHED && this._homeScore === 0 && this._awayScore === 0) return false;
    return true;
  }
}
