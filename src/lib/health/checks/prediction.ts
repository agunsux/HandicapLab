// Prediction Engine Dependency Health Check
// Location: src/lib/health/checks/prediction.ts

import { HealthCheck, HealthCheckResult } from '../types';
import { supabase } from '../../supabase.server';

export class PredictionCheck implements HealthCheck {
  public name = 'prediction';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      const { data, error } = await supabase
        .from('prediction_ledger_v3')
        .select('prediction_timestamp')
        .order('prediction_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          status: 'unhealthy',
          message: `${error.code}: ${error.message}`
        };
      }

      return {
        status: 'healthy',
        details: {
          lastPredictionTimestamp: data?.prediction_timestamp || null
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
