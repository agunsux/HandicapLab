// Controlled egress queue helpers
// Location: src/lib/crons/egressQueue.ts
//
// Thin, additive layer over the existing `event_queue` used by the controlled
// API-Football egress worker. It does NOT create a second queue. It only adds:
//   * a deterministic `event_key` (idempotent enqueue)
//   * an atomic claim via the `claim_next_event` RPC (FOR UPDATE SKIP LOCKED)
//   * stale-lease recovery
//
// Provider calls are never made here — only queue bookkeeping.

import { supabase } from '@/lib/supabase.server';
import { completeEvent, failEvent } from './eventQueue';

export const EGRESS_EVENT_TYPE = 'apifootball_job';

export type EgressJobName =
  | 'discovery'
  | 'enrichment'
  | 't60_snapshot'
  | 'ah_shadow'
  | 'generate_signals'
  | 'settle';

// Lower number = higher priority (matches event_queue semantics).
export const EGRESS_JOB_PRIORITY: Record<EgressJobName, number> = {
  settle: 10,
  t60_snapshot: 20,
  generate_signals: 30,
  enrichment: 40,
  discovery: 50,
  ah_shadow: 60,
};

export interface EgressEventRecord {
  id: string;
  event_type: string;
  fixture_id: string | null;
  payload: Record<string, unknown> | null;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  scheduled_for: string;
  event_key: string | null;
  lease_expires_at: string | null;
}

export interface EnqueueEgressJobOptions {
  job: EgressJobName;
  scope: string;
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
}

/** Deterministic idempotency key. Same job+scope resolves to one logical job. */
export function buildEgressEventKey(job: EgressJobName, scope: string): string {
  return `${EGRESS_EVENT_TYPE}:${job}:${scope}`;
}

/** UTC scope keys for scheduled idempotency windows. */
export function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function utcHourKey(date: Date = new Date()): string {
  return `${date.toISOString().slice(0, 13)}`;
}

export function utcFiveMinKey(date: Date = new Date()): string {
  const bucket = Math.floor(date.getUTCMinutes() / 5) * 5;
  return `${date.toISOString().slice(0, 13)}:${String(bucket).padStart(2, '0')}`;
}

/**
 * Idempotently enqueue an API-Football job. Duplicate active events for the same
 * key resolve to one job (the RPC returns the existing id).
 */
export async function enqueueEgressJob(options: EnqueueEgressJobOptions): Promise<string | null> {
  const { job, scope, payload, scheduledFor } = options;
  const eventKey = buildEgressEventKey(job, scope);

  const { data, error } = await supabase.rpc('enqueue_event', {
    p_event_type: EGRESS_EVENT_TYPE,
    p_fixture_id: null,
    p_payload: { job, scope, ...(payload ?? {}) },
    p_priority: EGRESS_JOB_PRIORITY[job],
    p_event_key: eventKey,
    p_scheduled_for: (scheduledFor ?? new Date()).toISOString(),
  });

  if (error) {
    throw new Error(`Failed to enqueue egress job ${job}: ${error.message}`);
  }
  return (data as string | null) ?? null;
}

/** Atomically claim the next pending API-Football job (never shared between workers). */
export async function claimNextEgressEvent(
  lockSeconds: number
): Promise<EgressEventRecord | null> {
  const { data, error } = await supabase.rpc('claim_next_event', {
    p_event_types: [EGRESS_EVENT_TYPE],
    p_lock_seconds: lockSeconds,
  });

  if (error) {
    throw new Error(`Failed to claim egress event: ${error.message}`);
  }

  const rows = (data as EgressEventRecord[] | EgressEventRecord | null) ?? null;
  if (!rows) return null;
  if (Array.isArray(rows)) return rows.length > 0 ? rows[0] : null;
  return rows;
}

/** Return expired processing leases to pending. */
export async function recoverExpiredEgressLeases(): Promise<number> {
  const { data, error } = await supabase.rpc('recover_expired_event_leases');
  if (error) {
    throw new Error(`Failed to recover expired egress leases: ${error.message}`);
  }
  return typeof data === 'number' ? data : 0;
}

export async function completeEgressEvent(eventId: string): Promise<void> {
  await completeEvent(eventId);
}

export async function failEgressEvent(eventId: string, errorMessage: string): Promise<void> {
  await failEvent(eventId, errorMessage, true);
}

export interface EgressQueueDepth {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}

export async function getEgressQueueDepth(): Promise<EgressQueueDepth> {
  const { data } = await supabase
    .from('event_queue')
    .select('status')
    .eq('event_type', EGRESS_EVENT_TYPE);

  const counts: EgressQueueDepth = { pending: 0, processing: 0, failed: 0, completed: 0 };
  for (const row of data ?? []) {
    const s = (row as { status: string }).status;
    if (s in counts) counts[s as keyof EgressQueueDepth] += 1;
  }
  return counts;
}
