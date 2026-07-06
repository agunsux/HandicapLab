// HandicapLab Live Data Platform - Market Event Bus
// Location: src/lib/data-platform/eventBus.ts

import crypto from 'crypto';

export interface StandardEvent {
  eventId: string;
  eventVersion: string;
  eventType: 'FixtureCreated' | 'OddsOpened' | 'OddsUpdated' | 'OddsSuspended' | 'OddsResumed' | 'OddsClosed';
  aggregateId: string;
  aggregateVersion: string;
  occurredAt: string;
  receivedAt: string;
  payload: any;
  checksum: string;
}

export class EventBus {
  private static eventsLog: StandardEvent[] = [];
  private static listeners = new Map<string, ((event: StandardEvent) => void)[]>();

  private static calculateChecksum(payload: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Publishes an event to all subscribers and appends to logs history.
   */
  public static publish(
    eventType: StandardEvent['eventType'],
    aggregateId: string,
    payload: any,
    eventVersion: string = '1.0.0',
    aggregateVersion: string = '1.0.0'
  ): StandardEvent {
    const occurredAt = new Date().toISOString();
    const checksum = this.calculateChecksum(payload);

    const event: StandardEvent = {
      eventId: crypto.randomUUID(),
      eventVersion,
      eventType,
      aggregateId,
      aggregateVersion,
      occurredAt,
      receivedAt: occurredAt,
      payload,
      checksum
    };

    // Append to immutable log
    this.eventsLog.push(event);

    // Trigger listeners
    const list = this.listeners.get(eventType) || [];
    list.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error(`[EventBus] Callback error:`, err);
      }
    });

    return event;
  }

  /**
   * Subscribes to specific event types.
   */
  public static subscribe(
    eventType: StandardEvent['eventType'],
    callback: (event: StandardEvent) => void
  ): void {
    const list = this.listeners.get(eventType) || [];
    list.push(callback);
    this.listeners.set(eventType, list);
  }

  /**
   * Gets historical events logs log history.
   */
  public static getEventsHistory(): StandardEvent[] {
    return this.eventsLog;
  }

  /**
   * Clears event logs (primarily for testing purposes).
   */
  public static clear(): void {
    this.eventsLog = [];
    this.listeners.clear();
  }
}
