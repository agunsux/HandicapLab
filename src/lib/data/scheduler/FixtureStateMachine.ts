// Fixture State Machine — Manages Fixture Lifecycle Transitions
// Location: src/lib/data/scheduler/FixtureStateMachine.ts
// States: SCHEDULED → LIVE → FINISHED → SETTLED → ARCHIVED

import { logger } from '@/lib/logger';
import type { FixtureLifecycleState, FixtureState, SchedulerEvent } from './types';
import { VALID_TRANSITIONS } from './types';

export class FixtureStateMachine {
  private fixtures: Map<string, FixtureState> = new Map();
  private events: SchedulerEvent[] = [];
  private log = logger.child('fixture-state-machine');

  /**
   * Register a fixture in the state machine.
   */
  registerFixture(fixtureId: string, initialState: FixtureLifecycleState = 'SCHEDULED'): FixtureState {
    const state: FixtureState = {
      fixtureId,
      state: initialState,
      enteredAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
    };
    this.fixtures.set(fixtureId, state);
    this.emitEvent({
      type: 'STATE_TRANSITION',
      fixtureId,
      toState: initialState,
      timestamp: new Date(),
      message: `Fixture ${fixtureId} registered as ${initialState}`,
    });
    return state;
  }

  /**
   * Transition a fixture to a new state. Returns false if transition is invalid.
   */
  transition(fixtureId: string, toState: FixtureLifecycleState): boolean {
    const current = this.fixtures.get(fixtureId);
    if (!current) {
      this.log.warn('transition_failed_fixture_not_found', { fixtureId, toState });
      return false;
    }

    const allowed = VALID_TRANSITIONS[current.state];
    if (!allowed.includes(toState)) {
      this.log.warn('transition_invalid', {
        fixtureId,
        fromState: current.state,
        toState,
        allowed,
      });
      return false;
    }

    const fromState = current.state;
    current.state = toState;
    current.retryCount = 0;
    current.error = undefined;
    current.updatedAt = new Date();

    if (fromState !== toState) {
      current.enteredAt = new Date();
    }

    this.emitEvent({
      type: 'STATE_TRANSITION',
      fixtureId,
      fromState,
      toState,
      timestamp: new Date(),
      message: `Fixture ${fixtureId}: ${fromState} → ${toState}`,
    });

    this.log.info('transition', { fixtureId, from: fromState, to: toState });
    return true;
  }

  /**
   * Get current state of a fixture.
   */
  getState(fixtureId: string): FixtureState | undefined {
    return this.fixtures.get(fixtureId);
  }

  /**
   * Get all fixtures in a given state.
   */
  getFixturesByState(state: FixtureLifecycleState): FixtureState[] {
    return Array.from(this.fixtures.values()).filter(f => f.state === state);
  }

  /**
   * Get count of fixtures in each state.
   */
  getStateCounts(): Record<FixtureLifecycleState, number> {
    const counts: Record<FixtureLifecycleState, number> = {
      SCHEDULED: 0,
      LIVE: 0,
      FINISHED: 0,
      SETTLED: 0,
      ARCHIVED: 0,
    };
    for (const f of this.fixtures.values()) {
      counts[f.state]++;
    }
    return counts;
  }

  /**
   * Increment retry count for a fixture.
   */
  incrementRetry(fixtureId: string): number {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) return 0;
    fixture.retryCount++;
    fixture.updatedAt = new Date();
    return fixture.retryCount;
  }

  /**
   * Set error on a fixture.
   */
  setError(fixtureId: string, error: string): void {
    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) return;
    fixture.error = error;
    fixture.updatedAt = new Date();

    this.emitEvent({
      type: 'ERROR',
      fixtureId,
      timestamp: new Date(),
      message: error,
    });
  }

  /**
   * Get all recent events.
   */
  getEvents(limit = 100): SchedulerEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Reset the state machine (clear all fixtures).
   */
  reset(): void {
    this.fixtures.clear();
    this.events = [];
    this.log.info('state_machine_reset');
  }

  /**
   * Get total number of registered fixtures.
   */
  get size(): number {
    return this.fixtures.size;
  }

  private emitEvent(event: SchedulerEvent): void {
    this.events.push(event);
  }
}
