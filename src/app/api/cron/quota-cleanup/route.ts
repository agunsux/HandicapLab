import { NextResponse } from 'next/server';
import { cleanupStaleReservations, getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';

/**
 * Cron Route: Provider quota maintenance.
 * Schedule: every 5 minutes.
 *
 * Reclaims stale quota reservations left behind by crashed/aborted requests so
 * they cannot permanently consume the API-Football daily allowance, then
 * reports the current quota state for observability.
 *
 * Secured via CRON_SECRET header (same pattern as other cron routes).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await cleanupStaleReservations(5);
    const snapshot = await getQuotaSnapshot('apifootball');

    return NextResponse.json({
      status: 'ok',
      cleanedStaleReservationsOlderThanMinutes: 5,
      apifootball: snapshot
        ? {
            mode: snapshot.mode,
            consumed: snapshot.consumed,
            reserved: snapshot.reserved,
            hardLimit: snapshot.hardLimit,
            softLimit: snapshot.softLimit,
            hardRemaining: snapshot.hardRemaining,
            resetAt: snapshot.resetAt,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[quota-cleanup cron] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
