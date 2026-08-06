// Market Intelligence Dependency Health Check (Lightweight Metadata)
// Location: src/lib/health/checks/market.ts

import { HealthCheck, HealthCheckResult } from '../types';

export class MarketCheck implements HealthCheck {
  public name = 'market';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const { supabase } = require('../../supabase.server');
      const { count, error } = await supabase.from('matches').select('*', { count: 'exact', head: true });

      if (error) {
        return {
          status: 'degraded',
          message: `Market query error: ${error.message}`
        };
      }

      return {
        status: 'healthy',
        details: {
          totalMatches: count || 0
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
