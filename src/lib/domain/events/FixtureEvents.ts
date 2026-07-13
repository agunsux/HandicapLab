import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class FixtureCreatedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.FIXTURE_CREATED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Fixture';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(fixtureId: string, homeTeamId: string, awayTeamId: string, kickoffTime: string, leagueId: string): FixtureCreatedEvent {
    return new FixtureCreatedEvent(_nextId(), fixtureId, Timestamp.now().toISO(), { fixtureId: fixtureId, homeTeamId: homeTeamId, awayTeamId: awayTeamId, kickoffTime: kickoffTime, leagueId: leagueId });
  }
}

export class FixtureUpdatedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.FIXTURE_UPDATED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Fixture';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(fixtureId: string, changes: Record<string, unknown>): FixtureUpdatedEvent {
    return new FixtureUpdatedEvent(_nextId(), fixtureId, Timestamp.now().toISO(), { fixtureId, changes });
  }
}
