// ============================================================================
// CANONICAL PERFORMANCE TIME-SERIES & BANKROLL CURVE API ROUTE
// ============================================================================
// Location: src/app/api/performance/timeseries/route.ts
//
// Serves chronological bankroll curve, cumulative profit, and drawdown sequence.
// Query params:
//   - starting_bankroll: initial bankroll units (default 100)
//   - market: filter by market ('AH', 'OU', 'BTTS')
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startingBankroll = parseFloat(searchParams.get('starting_bankroll') || '100.0');
    const market = searchParams.get('market')?.toUpperCase();

    let settled = CanonicalBetLedgerService.getSettledPredictions();
    if (market) {
      settled = settled.filter((p) => p.market === market);
    }

    const { curve, drawdown } = CanonicalPerformanceEngine.computeBankrollAndDrawdown(
      settled,
      startingBankroll
    );

    return NextResponse.json({
      success: true,
      startingBankroll,
      currentBankroll: drawdown.currentBankroll,
      drawdown,
      dataPointsCount: curve.length,
      curve,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to fetch performance time-series' },
      { status: 500 }
    );
  }
}
