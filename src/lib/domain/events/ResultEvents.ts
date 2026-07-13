import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class ResultCollectedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.RESULT_COLLECTED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Result';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(fixtureId: string, homeScore: number, awayScore: number, winner: string): ResultCollectedEvent {
    return new ResultCollectedEvent(_nextId(), fixtureId, Timestamp.now().toISO(), { fixtureId: fixtureId, homeScore: homeScore, awayScore: awayScore, winner: winner });
  }
}
