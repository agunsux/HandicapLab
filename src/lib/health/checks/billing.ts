// Billing Integration Dependency Health Check
// Location: src/lib/health/checks/billing.ts

import { HealthCheck, HealthCheckResult } from '../types';
import { supabase } from '../../supabase.server';

export class BillingCheck implements HealthCheck {
  public name = 'billing';

  public async run(): Promise<Omit<HealthCheckResult, 'latency_ms' | 'timestamp'>> {
    try {
      // 1. Audit billing provider keys (Stripe or Midtrans)
      const stripeConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
      
      // 2. Audit database connection to subscriptions table
      const { error } = await supabase
        .from('subscriptions')
        .select('id')
        .limit(1)
        .maybeSingle();

      // Check if table exists (a PGRST116 or empty result means table exists)
      const tableExists = !error || error.code === 'PGRST116';

      if (error && error.code !== 'PGRST116' && error.message.includes('does not exist')) {
        return {
          status: 'unhealthy',
          message: `subscriptions table unavailable: ${error.message}`
        };
      }

      const status = stripeConfigured ? 'healthy' : 'degraded';
      return {
        status,
        details: {
          stripeConfigured,
          subscriptionsTableOk: tableExists
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
