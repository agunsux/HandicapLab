/**
 * HandicapLab Domain-Driven Design — Domain Event Bus
 */
import { DomainEvent } from './DomainEvent';

export type EventHandler = (event: DomainEvent) => Promise<void>;

export class DomainEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, new Set());
    this.handlers.get(eventType).add(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) return;
    await Promise.all(Array.from(handlers).map(h => h(event)));
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  clear(): void { this.handlers.clear(); }

  subscriberCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }
}
