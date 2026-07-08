import { BaseCommand, BaseEventEnvelope } from './types';
import { EventSourcingLedger } from './EventSourcingLedger';
import { DecisionProjection } from './DecisionProjection';
import crypto from 'crypto';

export class CommandDispatcher {
  /**
   * The entry point for the Command side of CQRS.
   * Ensures atomic write to EventStore + Projection.
   */
  static dispatch(command: BaseCommand, handler: (cmd: BaseCommand) => BaseEventEnvelope[]): void {
    
    // 1. Execute Domain Logic (stateless pure function)
    const newEvents = handler(command);

    // 2. Transaction Boundary (Simulated)
    try {
      for (const event of newEvents) {
        // Enforce Event Envelope Invariants before saving
        this.validateEnvelope(event);

        // Save to immutable ledger (Throws if concurrency/idempotency fail)
        EventSourcingLedger.append(event, command.idempotency_key);
        
        // Synchronously update the CQRS Read Model
        DecisionProjection.apply(event);
      }
    } catch (error) {
      // In production PostgreSQL, we would ROLLBACK the transaction here
      // ensuring EventStore and ReadModel are never out of sync.
      throw error;
    }
  }

  /**
   * Generates standard metadata for new events.
   */
  static createEnvelope(
    eventType: BaseEventEnvelope['event_type'],
    aggregateId: string,
    correlationId: string,
    causationId: string,
    actor: string,
    version: number,
    payload: any
  ): BaseEventEnvelope {
    return {
      event_id: crypto.randomUUID(), // Should be ULID in production
      event_type: eventType,
      aggregate_id: aggregateId,
      correlation_id: correlationId,
      causation_id: causationId,
      version: version,
      schema_version: 'v1.0',
      actor: actor,
      event_time: new Date().toISOString(),
      processed_at: new Date().toISOString(), // In real world, this is assigned right before insert
      payload
    };
  }

  private static validateEnvelope(event: BaseEventEnvelope) {
    if (!event.correlation_id || !event.causation_id) {
      throw new Error(`Invalid Event Envelope: Must contain correlation_id and causation_id for lineage tracking.`);
    }
  }
}
