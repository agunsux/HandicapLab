// ============================================================================
// EVENT-DRIVEN PIPELINE  (Epic 31A — User refinement)
// ============================================================================
// Lightweight typed event bus for the settlement pipeline. Each stage emits
// events that downstream stages can subscribe to without tight coupling.
//
// Pipeline event flow:
//   OddsCaptured → ClosingOddsCaptured → MatchFinished
//     → SettlementCompleted → LedgerUpdated → MetricsUpdated
//
// This allows the system to be extended without modifying core logic:
// a new subscriber can react to SettlementCompleted without touching the
// settlement engine itself.
// ============================================================================

export type PipelineEventName =
  | 'odds:captured'
  | 'odds:closing_captured'
  | 'match:finished'
  | 'settlement:completed'
  | 'ledger:updated'
  | 'metrics:updated'
  | 'provider:failover'
  | 'provider:error';

/** Base event payload — all events carry at least a timestamp */
export interface BaseEventPayload {
  timestamp: string;
}

/** Odds captured payload */
export interface OddsCapturedPayload extends BaseEventPayload {
  fixtureId: string;
  provider: string;
  tickCount: number;
  marketTypes: string[];
}

/** Closing odds captured payload */
export interface ClosingOddsCapturedPayload extends BaseEventPayload {
  fixtureId: string;
  provider: string;
  closingOddsCount: number;
}

/** Match finished payload */
export interface MatchFinishedPayload extends BaseEventPayload {
  fixtureId: string;
  homeGoals: number;
  awayGoals: number;
  league: string;
  kickoff: string;
}

/** Settlement completed payload */
export interface SettlementCompletedPayload extends BaseEventPayload {
  fixtureId: string;
  settlementCount: number;
  outcomes: Record<string, string>; // predictionId → outcome
}

/** Ledger updated payload */
export interface LedgerUpdatedPayload extends BaseEventPayload {
  ledgerId: string;
  roi: number;
  sampleSize: number;
  profitLossUnits: number;
}

/** Metrics updated payload */
export interface MetricsUpdatedPayload extends BaseEventPayload {
  label: string;
  metrics: Record<string, number | string | null>;
  sampleSize: number;
}

/** Provider failover payload */
export interface ProviderFailoverPayload extends BaseEventPayload {
  failedProvider: string;
  failoverProvider: string;
  reason: string;
  fixtureId: string;
}

/** Provider error payload */
export interface ProviderErrorPayload extends BaseEventPayload {
  provider: string;
  errorMessage: string;
  fixtureId?: string;
  retryAttempt: number;
}

/** Union of all event payload types */
export type EventPayload =
  | OddsCapturedPayload
  | ClosingOddsCapturedPayload
  | MatchFinishedPayload
  | SettlementCompletedPayload
  | LedgerUpdatedPayload
  | MetricsUpdatedPayload
  | ProviderFailoverPayload
  | ProviderErrorPayload;

/** Event emitted by the pipeline */
export interface PipelineEvent {
  name: PipelineEventName;
  payload: EventPayload;
  id: string;
}

/** Subscriber function type */
export type EventSubscriber = (event: PipelineEvent) => void | Promise<void>;

/**
 * Typed event bus for the settlement pipeline.
 * Synchronous by default; subscribers that return a Promise are awaited
 * in sequence (ensuring ordering guarantees).
 */
export class EventBus {
  private subscribers: Map<PipelineEventName, Set<EventSubscriber>> = new Map();
  private eventCounter = 0;
  private emittedCount = 0;

  /** Subscribe to an event type */
  subscribe(eventName: PipelineEventName, handler: EventSubscriber): () => void {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    this.subscribers.get(eventName)!.add(handler);
    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventName)?.delete(handler);
    };
  }

  /** Subscribe to ALL events (wildcard) */
  subscribeAll(handler: EventSubscriber): () => void {
    const unsubscribes: (() => void)[] = [];
    const allEvents: PipelineEventName[] = [
      'odds:captured',
      'odds:closing_captured',
      'match:finished',
      'settlement:completed',
      'ledger:updated',
      'metrics:updated',
      'provider:failover',
      'provider:error',
    ];
    for (const eventName of allEvents) {
      unsubscribes.push(this.subscribe(eventName, handler));
    }
    return () => unsubscribes.forEach((u) => u());
  }

  /** Emit an event — calls all subscribers synchronously or awaits promises */
  async emit(name: PipelineEventName, payload: EventPayload): Promise<void> {
    this.eventCounter++;
    this.emittedCount++;
    const event: PipelineEvent = {
      name,
      payload: { ...payload, timestamp: payload.timestamp ?? new Date().toISOString() },
      id: `evt-${this.eventCounter}-${Date.now()}`,
    };

    const handlers = this.subscribers.get(name);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      const result = handler(event);
      if (result instanceof Promise) {
        await result;
      }
    }
  }

  /** Unsubscribe all handlers (useful in tests) */
  clear(): void {
    this.subscribers.clear();
    this.eventCounter = 0;
    this.emittedCount = 0;
  }

  /** Get count of emitted events */
  get totalEmitted(): number {
    return this.emittedCount;
  }

  /** Get count of subscribers for an event type */
  subscriberCount(eventName: PipelineEventName): number {
    return this.subscribers.get(eventName)?.size ?? 0;
  }
}

/** Singleton instance for the application */
export const pipelineEventBus = new EventBus();