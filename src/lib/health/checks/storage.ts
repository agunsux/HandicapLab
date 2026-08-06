// Storage & Environment Configuration Dependency Health Check
// Location: src/lib/health/checks/storage.ts

import { HealthCheck, HealthCheckResult } from '../types';

export class StorageCheck implements HealthCheck {
  public name = 'storage';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const apiFootballKey = process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY;
      const oddsApiKey = process.env.ODDSPAPI_KEY || process.env.ODDS_PAPI_KEY || process.env.THE_ODDS_API_KEY;

      const missingVars: string[] = [];
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) missingVars.push('SUPABASE_URL');
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!apiFootballKey) missingVars.push('API_FOOTBALL_KEY');
      if (!oddsApiKey) missingVars.push('ODDSPAPI_KEY');

      if (missingVars.length > 0) {
        return {
          status: 'unhealthy',
          message: `Missing critical environment variables: ${missingVars.join(', ')}`
        };
      }

      return {
        status: 'healthy',
        details: {
          configuredVarsCount: 4,
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
