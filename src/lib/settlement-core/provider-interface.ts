// ============================================================================
// PROVIDER ABSTRACTION LAYER  (Epic 31A — User refinement)
// ============================================================================
// This interface defines the contract for every odds provider integrated into
// HandicapLab. Adding a new provider requires implementing this interface;
// no ingestion code needs to be rewritten. This enables swapping providers
// (API-Football, The Odds API, OddsAPI, OddsPapi, Pinnacle, Betfair, etc.)
// without touching the core pipeline.
//
// The ProviderRegistry manages all registered providers and supports
// failover ordering, health checking, and capability discovery.
// ============================================================================

import type { OddsTick, MarketType } from './types';

/** Capabilities a provider may advertise */
export interface ProviderCapabilities {
  supportedMarkets: MarketType[];
  liveOdds: boolean;
  preMatchOdds: boolean;
  closingOdds: boolean;
  historicalData: boolean;
  maxRatePerSecond: number;
}

/** Health status returned by a provider */
export interface ProviderHealth {
  healthy: boolean;
  lastCheckedAt: string;
  latencyMs: number | null;
  errorMessage: string | null;
}

/** Configuration for a single provider instance */
export interface ProviderConfig {
  name: string;
  apiKey: string; // MUST come from secrets manager, never hardcoded
  baseUrl: string;
  rateLimitPerSecond: number;
  enabled: boolean;
  priority: number; // lower = higher priority for failover
  metadata?: Record<string, unknown>;
}

/** The contract every provider must implement */
export interface OddsProvider {
  /** Unique provider identifier (e.g., 'pinnacle', 'betfair', 'the-odds-api') */
  readonly name: string;
  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /** Fetch current odds for a fixture */
  fetchOdds(fixtureId: string): Promise<OddsTick[]>;

  /** Fetch opening odds for a fixture (historical) */
  fetchOpeningOdds(fixtureId: string): Promise<OddsTick[]>;

  /** Fetch closing odds for a fixture (historical) */
  fetchClosingOdds(fixtureId: string): Promise<OddsTick[]>;

  /** Check provider health */
  checkHealth(): Promise<ProviderHealth>;

  /** Return the provider's configuration (without the API key) */
  getConfig(): Omit<ProviderConfig, 'apiKey'>;
}

/**
 * Provider Registry — central registry of all available odds providers.
 * Manages registration, failover ordering, and lifecycle.
 */
export class ProviderRegistry {
  private providers: Map<string, OddsProvider> = new Map();
  private ordered: string[] = [];

  /** Register a provider */
  register(provider: OddsProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider '${provider.name}' is already registered`);
    }
    this.providers.set(provider.name, provider);
    this.rebuildOrder();
  }

  /** Unregister a provider */
  unregister(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) this.rebuildOrder();
    return removed;
  }

  /** Get a provider by name */
  get(name: string): OddsProvider | undefined {
    return this.providers.get(name);
  }

  /** Get all registered providers, ordered by priority (lowest first) */
  getAll(): OddsProvider[] {
    return this.ordered.map((name) => this.providers.get(name)!).filter(Boolean);
  }

  /** Get providers that support a specific market */
  getByMarket(market: MarketType): OddsProvider[] {
    return this.getAll().filter((p) => p.capabilities.supportedMarkets.includes(market));
  }

  /** Count registered providers */
  get count(): number {
    return this.providers.size;
  }

  /** Check health of all providers */
  async healthCheckAll(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();
    const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const health = await provider.checkHealth();
        results.set(name, health);
      } catch (err) {
        results.set(name, {
          healthy: false,
          lastCheckedAt: new Date().toISOString(),
          latencyMs: null,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    });
    await Promise.allSettled(checks);
    return results;
  }

  private rebuildOrder(): void {
    this.ordered = Array.from(this.providers.values())
      .sort((a, b) => {
        const aCfg = a.getConfig();
        const bCfg = b.getConfig();
        return (aCfg.priority ?? 999) - (bCfg.priority ?? 999);
      })
      .map((p) => p.name);
  }
}

/**
 * Generic failover selector — returns providers in priority order, skipping
 * any that are marked unhealthy (if health info is provided).
 */
export function selectFailoverOrder(
  registry: ProviderRegistry,
  market: MarketType,
  healthStatus?: Map<string, ProviderHealth>
): OddsProvider[] {
  const candidates = registry.getByMarket(market);
  if (!healthStatus) return candidates;
  return candidates.filter((p) => {
    const status = healthStatus.get(p.name);
    return !status || status.healthy;
  });
}