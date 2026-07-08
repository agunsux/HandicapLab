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

/**
 * Typed wrapper for dispatching model health alerts.
 * Maps HealthStatus → severity automatically.
 * Called by ModelHealthMonitor when health degrades.
 */
export async function dispatchModelAlert(
  modelVersion: string,
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'INSUFFICIENT_DATA',
  healthScore: number,
  driftedMetrics: string[]
): Promise<void> {
  if (healthStatus === 'HEALTHY' || healthStatus === 'INSUFFICIENT_DATA') return;

  const severity = healthStatus === 'CRITICAL' ? 'critical' : 'warning';
  const driftSummary = driftedMetrics.length > 0
    ? ` Drifted: [${driftedMetrics.join(', ')}].`
    : '';

  await insertAlert(
    'model_health_degraded',
    severity,
    `model_health_monitor:${modelVersion}`,
    `Model ${modelVersion} health score dropped to ${healthScore}/100 (${healthStatus}).${driftSummary}`,
    { modelVersion, healthScore, healthStatus, driftedMetrics }
  );
}
