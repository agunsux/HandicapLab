import { supabase } from '../../lib/supabase.server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../lib/auth/admin';

/**
 * Helper to insert an alert while respecting cooldown to avoid duplicate spam.
 *
 * Parameters:
 *   alertType - identifier of the alert (e.g., 'clv_failure')
 *   severity  - 'info' | 'warning' | 'critical'
 *   source    - component that generated the alert (e.g., 'health_endpoint')
 *   message   - human readable description
 *   metadata  - optional JSON payload with extra context
 */
export async function insertAlert(
  alertType: string,
  severity: 'info' | 'warning' | 'critical',
  source: string,
  message: string,
  metadata: any = {}
) {
  // Cooldown period: 1 hour (3600 seconds)
  const cooldownSeconds = 3600;
  const now = new Date();

  // Check for existing unresolved alert of same type+source within cooldown
  const { data: existing, error: fetchErr } = await supabase
    .from('system_alerts')
    .select('id, created_at')
    .eq('alert_type', alertType)
    .eq('source', source)
    .eq('resolved', false)
    .gte('created_at', new Date(now.getTime() - cooldownSeconds * 1000).toISOString())
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    // PGRST116 = No rows found – treat as not existing
    console.error('Alert lookup error:', fetchErr.message);
    return;
  }

  if (existing) {
    // Duplicate within cooldown – do not insert
    console.info('Alert suppressed (duplicate within cooldown):', alertType, source);
    return;
  }

  const insertPayload = {
    alert_type: alertType,
    severity,
    source,
    message,
    metadata,
  };

  const { error: insertErr } = await supabase.from('system_alerts').insert(insertPayload);
  if (insertErr) {
    console.error('Failed to insert alert:', insertErr.message);
  } else {
    console.info('Alert inserted:', alertType, source);
  }
}
