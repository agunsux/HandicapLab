import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class PredictionGeneratedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.PREDICTION_GENERATED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Prediction';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(fixtureId: string, modelId: string, homeProb: number, awayProb: number, drawProb: number | null, confidence: number): PredictionGeneratedEvent {
    return new PredictionGeneratedEvent(_nextId(), fixtureId, Timestamp.now().toISO(), { fixtureId: fixtureId, modelId: modelId, homeProb: homeProb, awayProb: awayProb, drawProb: drawProb, confidence: confidence });
  }
}
