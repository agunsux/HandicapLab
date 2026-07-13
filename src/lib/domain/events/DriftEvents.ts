import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class DriftDetectedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.DRIFT_DETECTED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Drift';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(modelId: string, driftType: string, metric: string, deviation: number, severity: string): DriftDetectedEvent {
    return new DriftDetectedEvent(_nextId(), modelId, Timestamp.now().toISO(), { modelId: modelId, driftType: driftType, metric: metric, deviation: deviation, severity: severity });
  }
}
