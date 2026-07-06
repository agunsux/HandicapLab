// HandicapLab Live Data Platform - Health Monitor
// Location: src/lib/data-platform/healthMonitor.ts

export interface ProviderHealthStatus {
  providerName: string;
  isOnline: boolean;
  latencyMs: number;
  errorRate: number; // 0-1 percentage
  packetLoss: number; // 0-1 percentage
  lastHeartbeat: string;
  staleDataAlert: boolean;
}

export class HealthMonitor {
  private static healthRegistry = new Map<string, ProviderHealthStatus>();

  /**
   * Updates health stats registry for a provider.
   */
  public static updateHealth(status: ProviderHealthStatus): void {
    this.healthRegistry.set(status.providerName.toLowerCase(), status);
  }

  /**
   * Retrieves health overview status for a provider.
   */
  public static getHealth(providerName: string): ProviderHealthStatus | null {
    return this.healthRegistry.get(providerName.toLowerCase()) || null;
  }

  /**
   * Returns complete health registry lists.
   */
  public static getFullStatus(): ProviderHealthStatus[] {
    return Array.from(this.healthRegistry.values());
  }

  /**
   * Checks if provider is healthy.
   */
  public static isHealthy(providerName: string): boolean {
    const status = this.getHealth(providerName);
    if (!status) return true; // default healthy if no track record
    return status.isOnline && status.errorRate < 0.20 && !status.staleDataAlert;
  }
}
