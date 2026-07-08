import { HealthEvent, HealthEventType } from './types';

/**
 * Layer 5: HealthEvent Store
 *
 * Append-only audit trail of all significant monitoring events.
 * Enables incident timelines, root cause analysis, and audit logs
 * without trawling raw application logs.
 *
 * In production, events are persisted to the `health_events` table.
 * The in-memory store here enables testing without a live DB.
 */

const eventStore: HealthEvent[] = [];

export class HealthEventLog {
  /**
   * Appends a new event to the event log.
   */
  static emit(
    eventType: HealthEventType,
    severity: 'info' | 'warning' | 'critical',
    modelVersion: string,
    message: string,
    metadata?: Record<string, unknown>
  ): HealthEvent {
    const event: HealthEvent = {
      id: Math.random().toString(36).substring(7),
      eventType,
      severity,
      timestamp: new Date(),
      modelVersion,
      message,
      metadata,
    };
    eventStore.push(event);
    return event;
  }

  /**
   * Returns all events, optionally filtered by model version and/or event type.
   */
  static query(
    modelVersion?: string,
    eventType?: HealthEventType,
    since?: Date
  ): HealthEvent[] {
    return eventStore.filter((e) => {
      if (modelVersion && e.modelVersion !== modelVersion) return false;
      if (eventType && e.eventType !== eventType) return false;
      if (since && e.timestamp < since) return false;
      return true;
    });
  }

  /**
   * Returns the last N events for a model.
   */
  static recent(modelVersion: string, n: number = 20): HealthEvent[] {
    return eventStore
      .filter((e) => e.modelVersion === modelVersion)
      .slice(-n)
      .reverse();
  }

  /**
   * Clears the in-memory store (for testing only).
   */
  static _clear(): void {
    eventStore.length = 0;
  }
}
