// ============================================================================
// CANONICAL SALMO SYNCHRONIZATION & INCREMENTAL CHANGE FEED API
// ============================================================================
// Location: src/app/api/v1/salmo/sync/route.ts
//
// Invariants enforced:
// 1. Authoritative canonical contract: SALMO is strictly a consumer/presentation layer.
// 2. Incremental sync support via 'since' parameter (returns updated_at > since).
// 3. Dynamic Daily Picks projection (Today, Tomorrow, 7 Days) rolls with calendar.
// 4. Zero synthetic/mock data. Fail-closed on missing inputs.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { SalmoSyncResponse } from '@/lib/archive/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sinceParam = searchParams.get('since') || undefined;
    const view = searchParams.get('view') || 'all'; // 'all' | 'daily_picks' | 'history' | 'performance'
    const horizonParam = (searchParams.get('horizon')?.toUpperCase() || 'ALL') as 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' | 'ALL';
    const marketParam = searchParams.get('market')?.toUpperCase() as any;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 1. Load dynamic daily picks projection
    const dailyPicks = PredictionArchiveService.getDailyPicksProjection({
      nowMs,
      horizon: horizonParam === 'ALL' ? undefined : horizonParam,
      market: ['AH', 'OU', 'ML', 'BTTS'].includes(marketParam) ? marketParam : undefined,
    });

    // 2. Load incremental archive records
    let predictions = PredictionArchiveService.getIncrementalUpdates(sinceParam);
    if (marketParam && ['AH', 'OU', 'ML', 'BTTS'].includes(marketParam)) {
      predictions = predictions.filter((p) => p.market === marketParam);
    }

    // 3. Load comprehensive performance report
    const performance = DailyPerformanceService.getArchivePerformanceReport({ nowMs });

    // 4. Compute Counts & State
    const allArchived = Object.values(PredictionArchiveService.loadArchive());
    const totalArchived = allArchived.length;
    const settledCount = allArchived.filter((p) => p.status === 'SETTLED' || p.status === 'VOID').length;
    const pendingCount = allArchived.filter((p) => p.status === 'ACTIVE' || p.status === 'GENERATED' || p.status === 'KICKED_OFF').length;

    let dataState: 'REAL' | 'CACHED' | 'NO_FIXTURES' | 'NO_QUALIFIED_PICKS' | 'DATA_UNAVAILABLE' = 'REAL';
    if (totalArchived === 0) {
      dataState = 'NO_FIXTURES';
    } else if (dailyPicks.length === 0 && pendingCount === 0) {
      dataState = 'NO_QUALIFIED_PICKS';
    }

    // 5. Generate deterministic sync checksum
    const checksumPayload = JSON.stringify({
      totalArchived,
      settledCount,
      dailyPicksCount: dailyPicks.length,
      latestUpdated: predictions[0]?.updatedAt || nowIso,
    });
    const syncChecksum = crypto.createHash('sha256').update(checksumPayload).digest('hex');

    const responsePayload: SalmoSyncResponse = {
      success: true,
      timestampUtc: nowIso,
      syncChecksum,
      dataState,
      counts: {
        totalArchived,
        dailyPicks: dailyPicks.length,
        settled: settledCount,
        pending: pendingCount,
      },
      dailyPicks: (view === 'all' || view === 'daily_picks') ? dailyPicks : [],
      predictions: (view === 'all' || view === 'history') ? predictions : [],
      performance: (view === 'all' || view === 'performance') ? performance : ({} as any),
    };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-HandicapLab-Sync-Checksum': syncChecksum,
        'X-Data-State': dataState,
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
        dataState: 'DATA_UNAVAILABLE',
      },
      { status: 500 }
    );
  }
}

