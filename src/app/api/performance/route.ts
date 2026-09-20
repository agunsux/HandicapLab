// ============================================================================
// HIGH-CONFIDENCE & OVERALL PERFORMANCE API ROUTE
// ============================================================================
// Location: src/app/api/performance/route.ts
//
// Serves:
//   1. Canonical High-Confidence Performance Report across horizons
//      (today, yesterday, 7-day, 30-day, all-time) and dimensions (market, band, league).
//   2. Backward-compatible paper-trading aggregation if source=paper-trading.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { PerformanceAggregator } from '@/lib/paper-trading/performanceAggregator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source');

  // If paper-trading is explicitly requested, preserve legacy contract
  if (source === 'paper-trading') {
    try {
      const stats = await PerformanceAggregator.aggregate();
      return NextResponse.json(stats);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
  }

  try {
    const report = await DailyPerformanceService.getOverallReport();
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[API /api/performance] Error generating performance report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error retrieving performance report' },
      { status: 500 }
    );
  }
}
