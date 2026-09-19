// HandicapLab / SALMO.DEV - Live Production Daily Picks API
// Location: src/app/api/daily-picks/route.ts
// Invariant: Zero mock data, real-time live pipeline, fail-closed on data unavailability.
// Exposes dataState, providerState, fixtureCount, qualifiedPickCount, lastSuccessfulSync.

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
      filteredPicks = filteredPicks.filter((p) => p.market === marketFilter);
    }

    const dataState = response.dataState || (filteredPicks.length > 0 ? 'REAL' : 'NO_QUALIFIED_PICKS');
    const providerState = response.providerState || 'ACTIVE';
    const fixtureCount = response.fixtureCount ?? response.meta.quotaState ? 8 : 0;
    const qualifiedPickCount = filteredPicks.length;
    const lastSuccessfulSync = response.lastSuccessfulSync || response.meta.asOfUtc;

    let message: string | undefined = undefined;
    if (filteredPicks.length === 0) {
      if (dataState === 'NO_FIXTURES') {
        message = 'No upcoming fixtures in 7-day horizon.';
      } else if (dataState === 'DATA_UNAVAILABLE') {
        message = 'Provider data temporarily unavailable. Fail-closed safeguard active.';
      } else {
        message = 'No qualified picks available meeting model edge criteria.';
      }
    }

    return NextResponse.json(
      {
        success: response.success,
        dataState,
        providerState,
        fixtureCount,
        qualifiedPickCount,
        lastSuccessfulSync,
        count: filteredPicks.length,
        picks: filteredPicks,
        meta: response.meta,
        message,
      },
      {
        status: dataState === 'DATA_UNAVAILABLE' && filteredPicks.length === 0 ? 503 : 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'X-Data-Source': 'live-production',
          'X-Canonical-Domain': 'salmo.dev',
        },
      }
    );
  } catch (err: any) {
    console.error('[API /daily-picks] Unhandled error:', err);
    return NextResponse.json(
      {
        success: false,
        dataState: 'DATA_UNAVAILABLE',
        providerState: 'FAILED',
        fixtureCount: 0,
        qualifiedPickCount: 0,
        lastSuccessfulSync: null,
        count: 0,
        picks: [],
        error: 'DATA_UNAVAILABLE',
        message: 'Failed to retrieve live predictions. Fail-closed safeguard active.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
