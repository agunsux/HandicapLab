import { CircuitBreaker, type CircuitState, type CircuitStatus } from '@/lib/http/CircuitBreaker';

export type ProviderHealthState = 'ACTIVE' | 'PAUSED' | 'FAILED' | 'DISABLED';

export interface ProviderHealthConfig {
  provider: string;
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenSuccessThreshold?: number;
}

export interface PersistedProviderHealth {
  provider: string;
  state: ProviderHealthState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  updatedAt: string;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 60_000;
const DEFAULT_HALF_OPEN_SUCCESS = 2;

export class ProviderHealthMonitor {
  readonly provider: string;
  private readonly breaker: CircuitBreaker;
  private disabled = false;
  private paused = false;
  private lastSuccessAt: string | null = null;
  private lastFailureAt: string | null = null;
  private consecutiveFailures = 0;
  private lastError: string | null = null;

  constructor(config: ProviderHealthConfig) {
    this.provider = config.provider;
    this.breaker = new CircuitBreaker({
      provider: config.provider,
      failureThreshold: config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      cooldownMs: config.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold ?? DEFAULT_HALF_OPEN_SUCCESS,
    });

    // Check operator environment overrides
    const upperProvider = this.provider.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const isPausedEnv = process.env[`${upperProvider}_PAUSED`] === 'true';
    const isDisabledEnv = process.env[`${upperProvider}_DISABLED`] === 'true';

    if (isDisabledEnv) {
      this.disabled = true;
    } else if (isPausedEnv) {
      this.paused = true;
    } else {
      // Load persisted health status on cold start
      this.loadPersistedState(config.cooldownMs ?? DEFAULT_COOLDOWN_MS);
    }
  }

  private getCachePath(): string | null {
    if (typeof window !== 'undefined') return null;
    try {
      // Dynamic require to prevent client-side bundler errors
      const pathMod = eval('require')('path');
      return pathMod.resolve(`data/cache/provider_health_${this.provider}.json`);
    } catch {
      return null;
    }
  }

  private loadPersistedState(cooldownMs: number): void {
    if (typeof window !== 'undefined') return;
    try {
      const p = this.getCachePath();
      if (!p) return;
      const fsMod = eval('require')('fs');
      if (fsMod.existsSync(p)) {
        const raw = fsMod.readFileSync(p, 'utf-8');
        const parsed: PersistedProviderHealth = JSON.parse(raw);
        this.lastSuccessAt = parsed.lastSuccessAt || null;
        this.lastFailureAt = parsed.lastFailureAt || null;
        this.consecutiveFailures = parsed.consecutiveFailures || 0;
        this.lastError = parsed.lastError || null;

        if (parsed.state === 'DISABLED') {
          this.disabled = true;
        } else if (parsed.state === 'FAILED' && this.lastFailureAt) {
          const elapsed = Date.now() - new Date(this.lastFailureAt).getTime();
          if (elapsed < cooldownMs) {
            // Still in cooldown period -> breaker stays tripped
            this.breaker.onFailure();
          }
        }
      }
    } catch {
      // Memory defaults if persistence read fails
    }
  }

  private persistState(): void {
    if (typeof window !== 'undefined') return;
    try {
      const p = this.getCachePath();
      if (!p) return;
      const pathMod = eval('require')('path');
      const fsMod = eval('require')('fs');
      const dir = pathMod.dirname(p);
      if (!fsMod.existsSync(dir)) {
        fsMod.mkdirSync(dir, { recursive: true });
      }
      const data: PersistedProviderHealth = {
        provider: this.provider,
        state: this.getState(),
        lastSuccessAt: this.lastSuccessAt,
        lastFailureAt: this.lastFailureAt,
        consecutiveFailures: this.consecutiveFailures,
        lastError: this.lastError,
        updatedAt: new Date().toISOString(),
      };
      fsMod.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Persistence error non-blocking
    }
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
    if (this.paused) return false; // Fail-closed when explicitly paused by operator
    return this.breaker.allowRequest();
  }

  pause(): void {
    this.paused = true;
    this.persistState();
  }

  resume(): void {
    this.paused = false;
    this.disabled = false;
    this.breaker.reset();
    this.consecutiveFailures = 0;
    this.persistState();
  }

  activateForTest(): void {
    this.paused = false;
    this.disabled = false;
    this.breaker.reset();
    this.consecutiveFailures = 0;
    this.persistState();
  }

  onSuccess(): void {
    this.lastSuccessAt = new Date().toISOString();
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.breaker.onSuccess();
    this.persistState();
  }

  /** Record a provider failure (network / 5xx / timeout). 4xx auth errors are NOT failures by default. */
  onFailure(err?: any): void {
    this.lastFailureAt = new Date().toISOString();
    this.consecutiveFailures++;
    if (err) {
      this.lastError = typeof err === 'string' ? err : err.message || JSON.stringify(err);
    }
    this.breaker.onFailure();
    this.persistState();
  }

  disable(): void {
    this.disabled = true;
    this.persistState();
  }

  enable(): void {
    this.disabled = false;
    this.breaker.reset();
    this.consecutiveFailures = 0;
    this.persistState();
  }

  reset(): void {
    this.disabled = false;
    this.paused = false;
    this.breaker.reset();
    this.consecutiveFailures = 0;
    this.persistState();
  }

  getStatus(): CircuitStatus & {
    providerState: ProviderHealthState;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
    lastError: string | null;
  } {
    return {
      ...this.breaker.getStatus(),
      providerState: this.getState(),
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
    };
  }
}

