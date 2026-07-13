import { DomainEvent, EVENT_TYPES } from './DomainEvent';
import { Timestamp } from '../shared/Timestamp';

let _counter = 0;
function _nextId(): string { _counter++; return 'evt_' + String(_counter).padStart(6, '0'); }

export class ResearchFinishedEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string = EVENT_TYPES.RESEARCH_FINISHED;
  readonly aggregateId: string;
  readonly aggregateType: string = 'Research';
  readonly timestamp: string;
  readonly version: number = 1;
  readonly payload: Record<string, unknown>;

  private constructor(eventId: string, aggregateId: string, timestamp: string, payload: Record<string, unknown>) {
    this.eventId = eventId; this.aggregateId = aggregateId; this.timestamp = timestamp; this.payload = payload;
    Object.freeze(this);
  }

  static create(researchId: string, conclusion: string, keyFindings: string[]): ResearchFinishedEvent {
    return new ResearchFinishedEvent(_nextId(), researchId, Timestamp.now().toISO(), { researchId: researchId, conclusion: conclusion, keyFindings: keyFindings });
  }
}
