// Circuit Breaker — State Machine for External API Resilience
// Location: src/lib/http/CircuitBreaker.ts
// States: CLOSED → OPEN (on failures) → HALF_OPEN (after cooldown) → CLOSED (on success)

import type { CircuitBreakerConfig } from './types';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStatus {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
}

export class CircuitBreaker {
  private readonly config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private openedAt: Date | null = null;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      cooldownMs: config.cooldownMs,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold,
      provider: config.provider,
    };
  }

  /**
   * Check if request is allowed through the circuit breaker.
   * Throws if circuit is OPEN and cooldown not yet elapsed.
   */
  async allowRequest(): Promise<boolean> {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      const cooldownElapsed = this.openedAt && (Date.now() - this.openedAt.getTime()) >= this.config.cooldownMs;
      if (cooldownElapsed) {
        this.transitionTo('HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN — allow limited requests
    return this.successCount < this.config.halfOpenSuccessThreshold;
  }

  /**
   * Record a successful request.
   */
  onSuccess(): void {
    this.lastSuccess = new Date();
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Record a failed request.
   */
  onFailure(): void {
    this.lastFailure = new Date();
    this.failureCount++;

    if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    } else if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Get current circuit status for monitoring.
   */
  getStatus(): CircuitStatus {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
    };
  }

  /**
   * Reset circuit breaker to initial closed state.
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.openedAt = null;
  }

  private transitionTo(newState: CircuitState): void {
    const prev = this.state;
    this.state = newState;
    if (newState === 'OPEN') {
      this.openedAt = new Date();
    }
    if (newState === 'CLOSED' || newState === 'HALF_OPEN') {
      this.successCount = 0;
    }
    if (newState === 'CLOSED') {
      this.failureCount = 0;
    }
  }
}
