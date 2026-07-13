import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class ChampionValidatedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.CHAMPION_VALIDATED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Model';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(modelId: string, challengerId: string, brierImproved: boolean, eceImproved: boolean): ChampionValidatedEvent {
    return new ChampionValidatedEvent(_nextId(), modelId, Timestamp.now().toISO(), { modelId: modelId, challengerId: challengerId, brierImproved: brierImproved, eceImproved: eceImproved });
  }
}
