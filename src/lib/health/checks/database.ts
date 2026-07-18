// Database Dependency Health Check
// Location: src/lib/health/checks/database.ts

import { HealthCheck, HealthCheckResult } from '../types';
import { supabase } from '../../supabase.server';

export class DatabaseCheck implements HealthCheck {
  public name = 'database';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const { error } = await supabase
        .from('matches')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          status: 'unhealthy',
          message: `${error.code}: ${error.message}`
        };
      }

      return {
        status: 'healthy'
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        message: err.message || String(err)
      };
    }
  }
}
