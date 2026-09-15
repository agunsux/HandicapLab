// GET /api/ops/egress-worker/status
// Authenticated, read-only view of the controlled API-Football egress worker.
// The worker has no public inbound endpoint; health is read from Supabase here.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getEgressMode } from '@/lib/crons/egressMode';
import { getEgressQueueDepth } from '@/lib/crons/egressQueue';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return unauthorized();
  }

  try {
    const { data: heartbeats, error } = await supabase
      .from('provider_worker_health')
      .select('*')
      .order('last_heartbeat_at', { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let queue = { pending: 0, processing: 0, failed: 0, completed: 0 };
    try {
      queue = await getEgressQueueDepth();
    } catch {
      // best-effort
    }

    const workers = (heartbeats ?? []).map((hb: Record<string, unknown>) => ({
      ...hb,
      egressIpDrift:
        Boolean(hb.expected_egress_ip) &&
        Boolean(hb.observed_egress_ip) &&
        hb.expected_egress_ip !== hb.observed_egress_ip,
    }));

    return NextResponse.json({
      success: true,
      egressMode: getEgressMode(),
      queue,
      workers,
      stale: workers.length === 0,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'status unavailable' },
      { status: 500 }
    );
  }
}
