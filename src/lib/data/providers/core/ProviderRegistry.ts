// Provider Registry — Dependency Injection for Data Providers
// Location: src/lib/data/providers/core/ProviderRegistry.ts
// Supports any provider implementing IFixturesProvider, IOddsProvider, or IResultsProvider.
// New providers register() without refactoring existing code.

import { logger } from '@/lib/logger';
import type { IFixturesProvider, IOddsProvider, IResultsProvider } from '../types';

export type ProviderType = 'fixtures' | 'odds' | 'results';

export interface ProviderHealthSummary {
  healthy: boolean;
  providers: Array<{
    name: string;
    type: ProviderType;
    healthy: boolean;
    error?: string;
    lastChecked: Date;
  }>;
  lastChecked: Date;
}

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private fixturesProviders: Map<string, IFixturesProvider> = new Map();
  private oddsProviders: Map<string, IOddsProvider> = new Map();
  private resultsProviders: Map<string, IResultsProvider> = new Map();
  private log = logger.child('provider-registry');

  private constructor() {}

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  registerFixturesProvider(name: string, provider: IFixturesProvider): void {
    this.fixturesProviders.set(name, provider);
    this.log.info('registered_fixtures_provider', { name });
  }

  registerOddsProvider(name: string, provider: IOddsProvider): void {
    this.oddsProviders.set(name, provider);
    this.log.info('registered_odds_provider', { name });
  }

  registerResultsProvider(name: string, provider: IResultsProvider): void {
    this.resultsProviders.set(name, provider);
    this.log.info('registered_results_provider', { name });
  }

  resolveFixtures(name?: string): IFixturesProvider {
    if (name) {
      const p = this.fixturesProviders.get(name);
      if (!p) throw new Error(`Fixtures provider '${name}' not registered`);
      return p;
    }
    // Return default (first registered)
    const first = this.fixturesProviders.values().next();
    if (first.done) throw new Error('No fixtures provider registered');
    return first.value;
  }

  resolveOdds(name?: string): IOddsProvider {
    if (name) {
      const p = this.oddsProviders.get(name);
      if (!p) throw new Error(`Odds provider '${name}' not registered`);
      return p;
    }
    const first = this.oddsProviders.values().next();
    if (first.done) throw new Error('No odds provider registered');
    return first.value;
  }

  resolveResults(name?: string): IResultsProvider {
    if (name) {
      const p = this.resultsProviders.get(name);
      if (!p) throw new Error(`Results provider '${name}' not registered`);
      return p;
    }
    const first = this.resultsProviders.values().next();
    if (first.done) throw new Error('No results provider registered');
    return first.value;
  }

  getRegisteredProviders(): { fixtures: string[]; odds: string[]; results: string[] } {
    return {
      fixtures: Array.from(this.fixturesProviders.keys()),
      odds: Array.from(this.oddsProviders.keys()),
      results: Array.from(this.resultsProviders.keys()),
    };
  }

  async checkAllHealth(): Promise<ProviderHealthSummary> {
    const results: ProviderHealthSummary['providers'] = [];
    const now = new Date();

    for (const [name, provider] of this.fixturesProviders) {
      try {
        const healthy = await provider.healthCheck();
        results.push({ name, type: 'fixtures', healthy, lastChecked: now });
      } catch (err: any) {
        results.push({ name, type: 'fixtures', healthy: false, error: err.message, lastChecked: now });
      }
    }
    for (const [name, provider] of this.oddsProviders) {
      try {
        const healthy = await provider.healthCheck();
        results.push({ name, type: 'odds', healthy, lastChecked: now });
      } catch (err: any) {
        results.push({ name, type: 'odds', healthy: false, error: err.message, lastChecked: now });
      }
    }
    for (const [name, provider] of this.resultsProviders) {
      try {
        const healthy = await provider.healthCheck();
        results.push({ name, type: 'results', healthy, lastChecked: now });
      } catch (err: any) {
        results.push({ name, type: 'results', healthy: false, error: err.message, lastChecked: now });
      }
    }

    return {
      healthy: results.every(r => r.healthy),
      providers: results,
      lastChecked: now,
    };
  }
}
