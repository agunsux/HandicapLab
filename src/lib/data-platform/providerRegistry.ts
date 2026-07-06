// HandicapLab Live Data Platform - Provider Registry
// Location: src/lib/data-platform/providerRegistry.ts

import { OddsProvider } from './providerInterface';
import { MockOddsProvider } from './mockAdapter';
import { FileOddsProvider } from './fileAdapter';

export class ProviderRegistry {
  private static registry = new Map<string, OddsProvider>();

  static {
    // Register default core adapters
    this.register('mock', new MockOddsProvider());
    this.register('file', new FileOddsProvider());
  }

  /**
   * Registers a pluggable data provider adapter.
   */
  public static register(name: string, provider: OddsProvider): void {
    this.registry.set(name.toLowerCase(), provider);
  }

  /**
   * Retrieves a provider by name.
   */
  public static get(name: string): OddsProvider | null {
    return this.registry.get(name.toLowerCase()) || null;
  }

  /**
   * Returns list of all active registered provider adapters.
   */
  public static getAll(): OddsProvider[] {
    return Array.from(this.registry.values());
  }

  /**
   * Reset registry (mainly for testing purposes).
   */
  public static clear(): void {
    this.registry.clear();
  }
}
// 
