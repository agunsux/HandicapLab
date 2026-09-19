// HandicapLab / SALMO.DEV - Live Production Upcoming Matches API
// Location: src/app/api/matches/route.ts
// Invariant: Zero mock fixtures, only future fixtures (kickoffUtc > nowUtc) within next 7 days.
// Single source of truth: CanonicalFixtureRegistry.

import { NextRequest, NextResponse } from 'next/server';
import { CanonicalFixtureRegistry } from '@/lib/services/canonicalFixtureRegistry';
import { supabase } from '@/lib/supabase.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true';
    const horizonParam = searchParams.get('horizon')?.toUpperCase();
    const horizon = horizonParam === 'TODAY' || horizonParam === 'TOMORROW' || horizonParam === 'WEEKEND' ? horizonParam : 'NEXT_7_DAYS';

    const registryRes = await CanonicalFixtureRegistry.getUpcomingFixtures({
      horizon,
      limit: 50,
      forceRefresh,
    });

    // Count qualified active daily picks for these upcoming fixtures
    let qualifiedPickCount = 0;
    try {
      const { count } = await supabase
        .from('active_daily_picks')
        .select('id', { count: 'exact', head: true });
      qualifiedPickCount = count || 0;
    } catch {
      qualifiedPickCount = 0;
    }

    const nowUtc = new Date().toISOString();

    return NextResponse.json({
      success: true,
      dataState: registryRes.dataState,
      providerState: registryRes.providerState,
      fixtureCount: registryRes.fixtures.length,
      qualifiedPickCount,
      lastSuccessfulSync: registryRes.lastSuccessfulSync,
      count: registryRes.fixtures.length,
      window: 'NOW → NOW + 7 DAYS',
      asOfUtc: nowUtc,
      canonicalDomain: 'salmo.dev',
      matches: registryRes.fixtures,
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
      dataState: 'DATA_UNAVAILABLE',
      providerState: 'FAILED',
      fixtureCount: 0,
      qualifiedPickCount: 0,
      lastSuccessfulSync: null,
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
