// Controlled egress worker — health & heartbeat
// Location: worker/health.ts
//
// Exposes worker health through Supabase (no public inbound endpoint required).
// The authenticated ops route `GET /api/ops/egress-worker/status` reads this row.

import { supabase } from '@/lib/supabase.server';

export interface HeartbeatInput {
  workerId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DEGRADED' | 'STOPPED';
  observedEgressIp: string | null;
  expectedEgressIp: string | null;
  queuePending: number;
  queueProcessing: number;
  queueFailed: number;
  providerState: string | null;
  quotaMode: string | null;
  lastJobId: string | null;
  lastJobType: string | null;
  lastJobStatus: string | null;
  lastError: string | null;
  version: string | null;
  concurrency: number;
  startedAt: string;
  metadata?: Record<string, unknown>;
}

/** Resolve the observed outbound IP. Never throws; returns null on failure. */
export async function resolveObservedEgressIp(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    try {
      const json = JSON.parse(text);
      const ip = (json?.ip ?? json?.origin) as unknown;
      return typeof ip === 'string' ? ip.split(',')[0].trim() : null;
    } catch {
      return /^[0-9a-fA-F:.]+$/.test(text) ? text : null;
    }
  } catch {
    return null;
  }
}

/** Persist a heartbeat row. Best-effort (health must never break processing). */
export async function writeHeartbeat(input: HeartbeatInput): Promise<void> {
  try {
    await supabase.from('provider_worker_health').upsert(
      {
        id: input.workerId,
        status: input.status,
        observed_egress_ip: input.observedEgressIp,
        expected_egress_ip: input.expectedEgressIp,
        queue_pending: input.queuePending,
        queue_processing: input.queueProcessing,
        queue_failed: input.queueFailed,
        provider_state: input.providerState,
        quota_mode: input.quotaMode,
        last_job_id: input.lastJobId,
        last_job_type: input.lastJobType,
        last_job_status: input.lastJobStatus,
        last_error: input.lastError,
        version: input.version,
        concurrency: input.concurrency,
        started_at: input.startedAt,
        last_heartbeat_at: new Date().toISOString(),
        metadata: input.metadata ?? {},
      },
      { onConflict: 'id' }
    );
  } catch {
    // Swallow: heartbeat is observability only.
  }
}
