// Settlement Engine Dependency Health Check
// Location: src/lib/health/checks/settlement.ts

import { HealthCheck, HealthCheckResult } from '../types';
import { supabase } from '../../supabase.server';

export class SettlementCheck implements HealthCheck {
  public name = 'settlement';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const { data: latestCron, error: cronError } = await supabase
        .from('cron_runs')
        .select('errors, start_time, duration_ms')
        .eq('cron_name', 'settle')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cronError) {
        return {
          status: 'unhealthy',
          message: `Cron runs query error: ${cronError.code}: ${cronError.message}`
        };
      }

      const hasCronErrors = latestCron && latestCron.errors;
      const status = hasCronErrors ? 'degraded' : 'healthy';

      return {
        status,
        details: {
          lastRunTime: latestCron?.start_time || null,
          durationMs: latestCron?.duration_ms || null,
          errors: latestCron?.errors || null
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
