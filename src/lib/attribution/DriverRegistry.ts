import { DriverStatistic } from './types';

export class DriverRegistry {
  // In Phase 1, we scaffold this with deterministic mock data.
  // In Phase 2, this reads from driver_statistics table.
  private static store = new Map<string, DriverStatistic>();

  /**
   * Retrieves historical statistics for a given driver.
   * If not found, returns a safe default for a new CANDIDATE driver.
   */
  static get(driverName: string): DriverStatistic {
    if (this.store.has(driverName)) {
      return this.store.get(driverName)!;
    }

    // Default for newly encountered drivers
    return {
      id: `driver-${Date.now()}`,
      name: driverName,
      category: 'DYNAMIC',
      lifecycle: 'CANDIDATE',
      frequency: 1,
      avgImpact: 0.1,
      historicalAccuracy: 0.5,
      historicalUtility: 0,
      stability: 50,
      reliabilityScore: 50,
      drift: 0,
      owner: 'system',
      status: 'Review',
      createdAt: new Date(),
      lastEvaluatedAt: new Date()
    };
  }

  /**
   * Populates the registry with predefined mock data for testing/scaffolding.
   */
  static _seedMockData(): void {
    this.store.set('home_attacking_pressure', {
      id: 'd1', name: 'home_attacking_pressure', category: 'IN_GAME', lifecycle: 'STABLE',
      frequency: 2143, avgImpact: 0.8, historicalAccuracy: 0.81, historicalUtility: 1.2,
      stability: 85, reliabilityScore: 92, drift: 0.02, owner: 'quant-team',
      status: 'Stable', createdAt: new Date(), lastEvaluatedAt: new Date()
    });

    this.store.set('market_underreaction', {
      id: 'd2', name: 'market_underreaction', category: 'MARKET', lifecycle: 'VALIDATED',
      frequency: 1201, avgImpact: 0.9, historicalAccuracy: 0.87, historicalUtility: 2.1,
      stability: 95, reliabilityScore: 96, drift: 0.01, owner: 'quant-team',
      status: 'Excellent', createdAt: new Date(), lastEvaluatedAt: new Date()
    });

    this.store.set('travel_fatigue', {
      id: 'd3', name: 'travel_fatigue', category: 'PRE_MATCH', lifecycle: 'EXPERIMENTAL',
      frequency: 324, avgImpact: 0.4, historicalAccuracy: 0.58, historicalUtility: 0.3,
      stability: 45, reliabilityScore: 63, drift: 0.1, owner: 'quant-team',
      status: 'Watch', createdAt: new Date(), lastEvaluatedAt: new Date()
    });

    this.store.set('weather_impact', {
      id: 'd4', name: 'weather_impact', category: 'ENVIRONMENT', lifecycle: 'DEPRECATED',
      frequency: 197, avgImpact: 0.2, historicalAccuracy: 0.46, historicalUtility: -0.1,
      stability: 22, reliabilityScore: 41, drift: 0.3, owner: 'quant-team',
      status: 'Review', createdAt: new Date(), lastEvaluatedAt: new Date()
    });
  }

  static _clear(): void {
    this.store.clear();
  }
}
