// ============================================================================
// CANONICAL SALMO SYNCHRONIZATION & REALTIME DATA SYNC ROUTE
// ============================================================================
// Location: src/app/api/v1/salmo/sync/route.ts
//
// Invariants enforced (Section A, C, M):
// 1. Authoritative canonical contract: HandicapLab is canonical source of truth;
//    SALMO is strictly consumer/presentation UI.
// 2. Stale Data Kill Switch: Daily picks strictly gated so kicked-off matches
//    (kickoffUtc <= nowUtc) NEVER appear in active Daily Picks feed.
// 3. Data states: 'REAL' | 'NO_QUALIFIED_PICKS' | 'DATA_TEMPORARILY_UNAVAILABLE'.
//    If canonical source is unavailable, displays DATA_TEMPORARILY_UNAVAILABLE
//    instead of serving stale historical fixtures or fallback mock data.
// 4. Returns canonical dailyPicks, settledHistory, performance, and freshness.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { SalmoProductionSyncService } from '@/lib/salmo/salmoProductionSyncService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sinceParam = searchParams.get('since') || undefined;
    const viewParam = (searchParams.get('view') || 'all') as any;
    const horizonParam = (searchParams.get('horizon')?.toUpperCase() || 'ALL') as any;
    const marketParam = searchParams.get('market')?.toUpperCase() as any;

    const nowMs = Date.now();

    const payload = SalmoProductionSyncService.generateSyncPayload({
      nowMs,
      since: sinceParam,
      view: viewParam,
      horizon: horizonParam,
      market: ['AH', 'OU', 'BTTS'].includes(marketParam) ? marketParam : undefined,
    });

    const httpStatus = payload.dataState === 'DATA_TEMPORARILY_UNAVAILABLE' ? 503 : 200;

    return NextResponse.json(payload, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-HandicapLab-Sync-Checksum': payload.syncChecksum,
        'X-Data-State': payload.dataState,
      },
    });
  } catch (err: any) {
    console.error('[API /api/v1/salmo/sync] Fatal error:', err);
    return NextResponse.json(
      {
        success: false,
        timestampUtc: new Date().toISOString(),
        error: 'INTERNAL_SYNC_ERROR',
        message: err.message || 'Failed to generate canonical SALMO sync payload.',
        dataState: 'DATA_TEMPORARILY_UNAVAILABLE',
        counts: { totalArchived: 0, dailyPicks: 0, settled: 0, pending: 0 },
        dailyPicks: [],
        settledHistory: [],
        performance: {},
        freshness: {
          fixtureFreshnessSlaSeconds: 3600,
          oddsFreshnessSlaSeconds: 3600,
          lastSyncTimestampUtc: new Date().toISOString(),
          upcomingFixturesCount: 0,
          activeDailyPicksCount: 0,
          status: 'STALE',
        },
      },
      { status: 503 }
    );
  }
}
