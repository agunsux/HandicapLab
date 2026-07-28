// EPIC 54 Stage I — Structured Audit Trail
// Every pipeline operation generates an audit event.
// Every prediction must be traceable from discovery through settlement.

import { supabase } from '@/lib/supabase.server';

export interface AuditEvent {
  jobId: string;
  fixtureId?: string;
  leagueId?: number;
  triggerSource: string;
  stateTransition?: string;
  eventType?: string;
  provider?: string;
  endpoint?: string;
  durationMs?: number;
  quotaConsumed?: number;
  retryCount?: number;
  outcome: 'success' | 'failure' | 'skipped' | 'partial';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// Record a structured audit event (fire-and-forget — never blocks the pipeline)
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await supabase.from('audit_trail').insert({
      job_id: event.jobId,
      fixture_id: event.fixtureId ?? null,
      league_id: event.leagueId ?? null,
      trigger_source: event.triggerSource,
      state_transition: event.stateTransition ?? null,
      event_type: event.eventType ?? null,
      provider: event.provider ?? null,
      endpoint: event.endpoint ?? null,
      duration_ms: event.durationMs ?? null,
      quota_consumed: event.quotaConsumed ?? 0,
      retry_count: event.retryCount ?? 0,
      outcome: event.outcome,
      error_message: event.errorMessage ?? null,
      metadata: event.metadata ?? null,
    });
  } catch (err) {
    console.error('[AuditTrail] Failed to record event:', err);
  }
}

// Helper: wrap an async operation with audit logging
export async function audited<T>(
  jobId: string,
  triggerSource: string,
  fn: () => Promise<T>,
  opts?: {
    fixtureId?: string;
    leagueId?: number;
    provider?: string;
    endpoint?: string;
  }
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    void recordAuditEvent({
      jobId,
      triggerSource,
      fixtureId: opts?.fixtureId,
      leagueId: opts?.leagueId,
      provider: opts?.provider,
      endpoint: opts?.endpoint,
      durationMs: Date.now() - start,
      outcome: 'success',
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void recordAuditEvent({
      jobId,
      triggerSource,
      fixtureId: opts?.fixtureId,
      leagueId: opts?.leagueId,
      provider: opts?.provider,
      endpoint: opts?.endpoint,
      durationMs: Date.now() - start,
      outcome: 'failure',
      errorMessage: message,
    });
    throw err;
  }
}

// Query recent audit events
export async function getRecentAuditEvents(limit: number = 50): Promise<Array<Record<string, unknown>>> {
  const { data } = await supabase
    .from('audit_trail')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  return data ?? [];
}

// Get audit summary: counts by outcome for the last 24h
export async function getAuditSummary(): Promise<{
  total: number;
  success: number;
  failure: number;
  skipped: number;
  avgDurationMs: number;
}> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data } = await supabase
    .from('audit_trail')
    .select('outcome, duration_ms')
    .gte('timestamp', cutoff);

  if (!data || data.length === 0) {
    return { total: 0, success: 0, failure: 0, skipped: 0, avgDurationMs: 0 };
  }

  const total = data.length;
  const success = data.filter((r) => r.outcome === 'success').length;
  const failure = data.filter((r) => r.outcome === 'failure').length;
  const skipped = data.filter((r) => r.outcome === 'skipped').length;
  const totalMs = data.reduce((acc, r) => acc + ((r.duration_ms as number) ?? 0), 0);

  return {
    total,
    success,
    failure,
    skipped,
    avgDurationMs: total > 0 ? Math.round(totalMs / total) : 0,
  };
}
