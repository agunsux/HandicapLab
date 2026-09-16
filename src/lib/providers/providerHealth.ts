// Provider Health States & Circuit Breaking
// Location: src/lib/providers/providerHealth.ts
//
// Wraps the low-level CircuitBreaker (CLOSED/OPEN/HALF_OPEN) with the
// operator-facing provider states required by the runbook:
//
//   ACTIVE    -> circuit CLOSED, requests allowed
//   PAUSED    -> circuit HALF_OPEN, only controlled health probes allowed
//   FAILED    -> circuit OPEN, all requests rejected until cooldown
//   DISABLED  -> intentionally disabled (maintenance / compliance stop)
//
// Reuses `src/lib/http/CircuitBreaker.ts`; it does NOT introduce a second
// circuit-breaker implementation.

import { CircuitBreaker, type CircuitState, type CircuitStatus } from '@/lib/http/CircuitBreaker';

export type ProviderHealthState = 'ACTIVE' | 'PAUSED' | 'FAILED' | 'DISABLED';

export interface ProviderHealthConfig {
  provider: string;
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenSuccessThreshold?: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 60_000;
const DEFAULT_HALF_OPEN_SUCCESS = 2;

export class ProviderHealthMonitor {
  readonly provider: string;
  private readonly breaker: CircuitBreaker;
  private disabled = false;
  private paused = false;

  constructor(config: ProviderHealthConfig) {
    this.provider = config.provider;
    // P0.2 Invariant: API-Football MUST default to PAUSED on cold start
    if (this.provider === 'apifootball') {
      this.paused = true;
    }
    this.breaker = new CircuitBreaker({
      provider: config.provider,
      failureThreshold: config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      cooldownMs: config.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold ?? DEFAULT_HALF_OPEN_SUCCESS,
    });
  }

  static mapCircuitState(state: CircuitState): ProviderHealthState {
    switch (state) {
      case 'CLOSED':
        return 'ACTIVE';
      case 'HALF_OPEN':
        return 'PAUSED';
      case 'OPEN':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }

  getState(): ProviderHealthState {
    if (this.disabled) return 'DISABLED';
    if (this.paused) return 'PAUSED';
    return ProviderHealthMonitor.mapCircuitState(this.breaker.getStatus().state);
  }

  async allowRequest(): Promise<boolean> {
    if (this.disabled) return false;
    if (this.paused) return false; // Fail-closed when paused
    return this.breaker.allowRequest();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.disabled = false;
  }

  activateForTest(): void {
    this.paused = false;
    this.disabled = false;
    this.breaker.reset();
  }

  onSuccess(): void {
    this.breaker.onSuccess();
  }

  /** Record a provider failure (network / 5xx / timeout). 4xx auth errors are NOT failures by default. */
  onFailure(): void {
    this.breaker.onFailure();
  }

  disable(): void {
    this.disabled = true;
  }

  enable(): void {
    this.disabled = false;
    this.breaker.reset();
  }

  reset(): void {
    this.disabled = false;
    this.breaker.reset();
  }

  getStatus(): CircuitStatus & { providerState: ProviderHealthState } {
    return { ...this.breaker.getStatus(), providerState: this.getState() };
  }
}
