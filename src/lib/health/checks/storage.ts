// Storage & Environment Configuration Dependency Health Check
// Location: src/lib/health/checks/storage.ts

import { HealthCheck, HealthCheckResult } from '../types';

export class StorageCheck implements HealthCheck {
  public name = 'storage';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'API_FOOTBALL_KEY',
        'ODDSPAPI_KEY',
        'CRON_SECRET'
      ];

      const missingVars = requiredVars.filter(v => !process.env[v]);

      if (missingVars.length > 0) {
        return {
          status: 'unhealthy',
          message: `Missing critical environment variables: ${missingVars.join(', ')}`
        };
      }

      return {
        status: 'healthy',
        details: {
          configuredVarsCount: requiredVars.length,
          missingVarsCount: 0
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
