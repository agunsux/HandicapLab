// HandicapLab / SALMO.DEV - Live Production Daily Picks API
// Location: src/app/api/daily-picks/route.ts
// Invariant: Zero mock data, real-time live pipeline, fail-closed on data unavailability.

import { NextRequest, NextResponse } from 'next/server';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('force') === 'true';
    const marketFilter = searchParams.get('market')?.toUpperCase();

    const response = await DailyPicksEngine.getDailyPicks({ forceRefresh });

    // Apply market filter if requested (AH, OU, BTTS)
    let filteredPicks = response.picks;
    if (marketFilter && ['AH', 'OU', 'BTTS'].includes(marketFilter)) {
      filteredPicks = filteredPicks.filter(p => p.market === marketFilter);
    }

    return NextResponse.json({
      success: response.success,
      count: filteredPicks.length,
      picks: filteredPicks,
      meta: response.meta,
      message: filteredPicks.length === 0 ? 'No qualified picks today.' : undefined,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Data-Source': 'live-production',
        'X-Canonical-Domain': 'salmo.dev',
      },
    });
  } catch (err: any) {
    console.error('[API /daily-picks] Unhandled error:', err);
    return NextResponse.json({
      success: false,
      count: 0,
      picks: [],
      error: 'DATA_UNAVAILABLE',
      message: 'Failed to retrieve live predictions. Fail-closed safeguard active.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
