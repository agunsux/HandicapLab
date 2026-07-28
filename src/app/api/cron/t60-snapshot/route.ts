// EPIC 52 Stage C — T-60 Pre-Match Snapshot Cron Route
// Fired every 5-10 minutes by Vercel Cron Jobs.
// Scans for upcoming fixtures within their T-60 window and builds snapshots.

import { NextResponse } from 'next/server';
import { runT60Snapshot } from '@/lib/crons/t60Snapshot';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runT60Snapshot();
    console.log(`[T60Snapshot] Snapshots built: ${result.total} / ${result.snapshots.length} fixtures`);
    for (const s of result.snapshots.filter(x => !x.success)) {
      console.warn(`[T60Snapshot] FAILED: ${s.homeTeam} vs ${s.awayTeam} — dataGap: ${s.dataGap.join(',')}`);
    }
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[T60Snapshot Cron] Fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
