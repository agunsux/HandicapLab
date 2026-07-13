import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class OddsCapturedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.ODDS_CAPTURED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Odds';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(fixtureId: string, providerId: string, marketType: string, line: number): OddsCapturedEvent {
    return new OddsCapturedEvent(_nextId(), fixtureId, Timestamp.now().toISO(), { fixtureId: fixtureId, providerId: providerId, marketType: marketType, line: line });
  }
}
