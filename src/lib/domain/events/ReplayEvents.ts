import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class ReplayCompletedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.REPLAY_COMPLETED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Replay';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(datasetId: string, fixtureCount: number, successCount: number, failureCount: number): ReplayCompletedEvent {
    return new ReplayCompletedEvent(_nextId(), datasetId, Timestamp.now().toISO(), { datasetId: datasetId, fixtureCount: fixtureCount, successCount: successCount, failureCount: failureCount });
  }
}
