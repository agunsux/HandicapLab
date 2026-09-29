// ============================================================================
// CANONICAL PERFORMANCE BY BOOKMAKER API ROUTE
// ============================================================================
// Location: src/app/api/performance/bookmakers/route.ts
//
// Serves performance breakdown by provider/bookmaker from the canonical ledger.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const report = CanonicalPerformanceEngine.generateReport();
    return NextResponse.json({
      success: true,
      generatedAtUtc: report.generatedAtUtc,
      totalPredictions: report.totalPredictions,
      settledPredictions: report.settledPredictions,
      byBookmaker: report.byBookmaker,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to fetch bookmaker performance' },
      { status: 500 }
    );
  }
}
