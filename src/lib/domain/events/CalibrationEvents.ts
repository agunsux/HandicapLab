import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class CalibrationCompletedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.CALIBRATION_COMPLETED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Calibration';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(modelId: string, datasetId: string, ece: number, brierScore: number): CalibrationCompletedEvent {
    return new CalibrationCompletedEvent(_nextId(), modelId, Timestamp.now().toISO(), { modelId: modelId, datasetId: datasetId, ece: ece, brierScore: brierScore });
  }
}
