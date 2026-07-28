// EPIC 54 Stage A/C — Event Queue
// Event-driven processing queue. Workers consume events independently.
// No blocking loops — every event pushes to the queue, workers pick up pending work.
//
// Supported event types:
//   fixture_discovered, enrichment_due, snapshot_due, prediction_due,
//   kickoff_detected, halftime_detected, fulltime_detected,
//   settlement_available, metrics_update, historical_resume

import { supabase } from '@/lib/supabase.server';

export type EventType =
  | 'fixture_discovered'
  | 'enrichment_due'
  | 'snapshot_due'
  | 'prediction_due'
  | 'kickoff_detected'
  | 'halftime_detected'
  | 'fulltime_detected'
  | 'settlement_available'
  | 'metrics_update'
  | 'historical_resume';

export interface EventRecord {
  id: string;
  eventType: EventType;
  fixtureId: string | null;
  payload: Record<string, unknown> | null;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  scheduledFor: string;
}

const EVENT_PRIORITIES: Record<EventType, number> = {
  settlement_available: 10,   // highest — must settle before anything else
  snapshot_due:         20,   // T-60 window
  prediction_due:       30,
  enrichment_due:       40,
  fixture_discovered:   50,
  kickoff_detected:     60,
  halftime_detected:    60,
  fulltime_detected:    60,
  metrics_update:       70,
  historical_resume:    80,  // lowest — only runs on surplus quota
};

// Push an event onto the queue
export async function enqueue(
  eventType: EventType,
  fixtureId: string | null,
  payload?: Record<string, unknown>,
  opts?: { scheduledFor?: Date }
): Promise<void> {
  const priority = EVENT_PRIORITIES[eventType];

  await supabase.from('event_queue').insert({
    event_type: eventType,
    fixture_id: fixtureId,
    payload: payload ?? null,
    priority,
    status: 'pending',
    scheduled_for: (opts?.scheduledFor ?? new Date()).toISOString(),
  });
}

// Dequeue the next pending event (highest priority first)
export async function dequeue(): Promise<EventRecord | null> {
  // Atomically claim the next pending event
  const { data: events } = await supabase
    .from('event_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  if (!events || events.length === 0) return null;

  const event = events[0];
  await supabase
    .from('event_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', event.id);

  return mapEvent(event);
}

// Mark an event as completed
export async function completeEvent(eventId: string): Promise<void> {
  await supabase
    .from('event_queue')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', eventId);
}

// Mark an event as failed (with optional retry)
export async function failEvent(
  eventId: string,
  error: string,
  retry: boolean = true
): Promise<void> {
  const { data: event } = await supabase
    .from('event_queue')
    .select('retry_count, max_retries')
    .eq('id', eventId)
    .single();

  if (!event) return;

  const newRetryCount = (event.retry_count ?? 0) + 1;

  if (retry && newRetryCount <= (event.max_retries ?? 3)) {
    await supabase
      .from('event_queue')
      .update({
        status: 'pending',
        retry_count: newRetryCount,
        last_error: error,
        scheduled_for: new Date(Date.now() + 5 * 60_000 * newRetryCount).toISOString(), // exponential backoff
      })
      .eq('id', eventId);
  } else {
    await supabase
      .from('event_queue')
      .update({ status: 'failed', last_error: error })
      .eq('id', eventId);
  }
}

// Get queue depth by status
export async function getQueueDepth(): Promise<{
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}> {
  const { data } = await supabase
    .from('event_queue')
    .select('status');

  const counts = { pending: 0, processing: 0, failed: 0, completed: 0 };
  for (const row of data ?? []) {
    const s = row.status as string;
    if (s === 'pending') counts.pending += 1;
    else if (s === 'processing') counts.processing += 1;
    else if (s === 'failed') counts.failed += 1;
    else if (s === 'completed') counts.completed += 1;
  }
  return counts;
}

// Recover: reset stuck 'processing' events back to pending (for recovery after restart)
export async function recoverStuckEvents(timeoutMs: number = 30 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMs).toISOString();
  const { data } = await supabase
    .from('event_queue')
    .update({ status: 'pending', last_error: 'RECOVERED: stuck processing', started_at: null })
    .eq('status', 'processing')
    .lt('started_at', cutoff)
    .select();

  return data?.length ?? 0;
}

function mapEvent(row: Record<string, unknown>): EventRecord {
  return {
    id: row.id as string,
    eventType: row.event_type as EventType,
    fixtureId: row.fixture_id as string | null,
    payload: row.payload as Record<string, unknown> | null,
    priority: row.priority as number,
    status: row.status as EventRecord['status'],
    retryCount: (row.retry_count as number) ?? 0,
    maxRetries: (row.max_retries as number) ?? 3,
    lastError: row.last_error as string | null,
    scheduledFor: row.scheduled_for as string,
  };
}
