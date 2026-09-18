// HandicapLab / SALMO.DEV - Live Production Upcoming Matches API
// Location: src/app/api/matches/route.ts
// Invariant: Zero mock fixtures, only future fixtures (kickoffUtc > nowUtc) within next 7 days.

import { NextRequest, NextResponse } from 'next/server';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true';

    const matches = await DailyPicksEngine.getUpcomingMatches();
    const nowUtc = new Date().toISOString();

    return NextResponse.json({
      success: true,
      count: matches.length,
      window: 'NOW → NOW + 7 DAYS',
      asOfUtc: nowUtc,
      canonicalDomain: 'salmo.dev',
      matches,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Data-Source': 'live-production',
        'X-Canonical-Domain': 'salmo.dev',
      },
    });
  } catch (err: any) {
    console.error('[API /matches] Error fetching real matches:', err);
    return NextResponse.json({
      success: false,
      count: 0,
      window: 'NOW → NOW + 7 DAYS',
      matches: [],
      error: 'DATA_UNAVAILABLE',
      message: 'Failed to retrieve upcoming live fixtures.',
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
