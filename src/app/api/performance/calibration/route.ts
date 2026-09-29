// ============================================================================
// CANONICAL PERFORMANCE CALIBRATION API ROUTE
// ============================================================================
// Location: src/app/api/performance/calibration/route.ts
//
// Serves probability calibration curve, expected vs empirical win rates,
// and overall Brier score from the canonical bet ledger.
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
      calibration: report.calibration,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to fetch calibration metrics' },
      { status: 500 }
    );
  }
}
