// Scheduler Types — Fixture Lifecycle State Machine
// Location: src/lib/data/scheduler/types.ts

export type FixtureLifecycleState = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'SETTLED' | 'ARCHIVED';

export const VALID_TRANSITIONS: Record<FixtureLifecycleState, FixtureLifecycleState[]> = {
  SCHEDULED: ['LIVE'],
  LIVE: ['FINISHED'],
  FINISHED: ['SETTLED'],
  SETTLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export interface FixtureState {
  fixtureId: string;
  state: FixtureLifecycleState;
  enteredAt: Date;
  updatedAt: Date;
  retryCount: number;
  error?: string;
}

export interface SchedulerConfig {
  /** How often to poll for state transitions (ms) */
  pollIntervalMs: number;
  /** Max retries before marking as failed */
  maxRetries: number;
  /** Fetch upcoming fixtures window (ms ahead) */
  lookAheadMs: number;
  /** After how long since FINISHED should we auto-settle? (ms) */
  autoSettleAfterMs: number;
  /** After how long since SETTLED should we archive? (ms) */
  autoArchiveAfterMs: number;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  pollIntervalMs: 60_000,
  maxRetries: 3,
  lookAheadMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  autoSettleAfterMs: 2 * 60 * 60 * 1000, // 2 hours after finish
  autoArchiveAfterMs: 7 * 24 * 60 * 60 * 1000, // 7 days after settle
};

export interface SchedulerEvent {
  type: 'STATE_TRANSITION' | 'FETCH_FIXTURES' | 'FETCH_ODDS' | 'ERROR' | 'SETTLE' | 'ARCHIVE';
  fixtureId?: string;
  fromState?: FixtureLifecycleState;
  toState?: FixtureLifecycleState;
  timestamp: Date;
  message: string;
  metadata?: Record<string, unknown>;
}
