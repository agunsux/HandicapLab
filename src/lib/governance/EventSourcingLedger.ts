import { BaseEventEnvelope } from './types';

export class EventSourcingLedger {
  // In Phase 1, we use a simple in-memory Map to represent the PostgreSQL table.
  // The structure enforces Append-Only and Optimistic Concurrency.
  private static events: BaseEventEnvelope[] = [];
  
  /** Tracks command idempotency keys to prevent duplicate event creation */
  private static idempotencyRegistry: Set<string> = new Set();

  /**
   * Appends a new event to the ledger.
   * Throws if optimistic concurrency checks fail or if idempotency_key is reused.
   */
  static append(event: BaseEventEnvelope, idempotencyKey: string): void {
    if (this.idempotencyRegistry.has(idempotencyKey)) {
      // Command already processed successfully.
      // We gracefully return (Idempotency) without appending a duplicate.
      return; 
    }

    // Optimistic Concurrency Check (Fetch latest version for aggregate)
    const currentVersion = this.getLatestVersion(event.aggregate_id);
    if (event.version !== currentVersion + 1) {
      throw new Error(`ConcurrencyConflictError: Expected version ${currentVersion + 1}, but got ${event.version} for aggregate ${event.aggregate_id}`);
    }

    // Append-Only
    this.events.push(Object.freeze({ ...event })); // Freeze enforces immutability in runtime
    this.idempotencyRegistry.add(idempotencyKey);
  }

  /**
   * Retrieves the full event stream for an aggregate to rebuild state.
   */
  static getStream(aggregateId: string): BaseEventEnvelope[] {
    return this.events.filter(e => e.aggregate_id === aggregateId).sort((a, b) => a.version - b.version);
  }

  private static getLatestVersion(aggregateId: string): number {
    const stream = this.getStream(aggregateId);
    if (stream.length === 0) return 0;
    return stream[stream.length - 1].version;
  }

  // --- Testing Helpers ---
  static _clear(): void {
    this.events = [];
    this.idempotencyRegistry.clear();
  }
}
