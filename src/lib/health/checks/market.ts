// Market Intelligence Dependency Health Check
// Location: src/lib/health/checks/market.ts

import { HealthCheck, HealthCheckResult } from '../types';

export class MarketCheck implements HealthCheck {
  public name = 'market';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      // Use dynamic import to maintain strict bundle boundaries and prevent NFT tracing
      const { MarketLogRepository } = await import('../../data/marketLogRepository.runtime');
      const results = await MarketLogRepository.getCLVResults();
      
      return {
        status: 'healthy',
        details: {
          clvRecordCount: results.length
        }
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        message: err.message || String(err)
      };
    }
  }
}
