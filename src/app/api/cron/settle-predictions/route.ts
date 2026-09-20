// ============================================================================
// AUTOMATIC PREDICTION SETTLEMENT CRON ROUTE
// ============================================================================
// Location: src/app/api/cron/settle-predictions/route.ts
//
// Automatically triggered by scheduler / Vercel Cron.
// 1. Locks bets past kickoff in High-Confidence Ledger.
// 2. Fetches authoritative final scores from API-Football.
// 3. Settles completed bets via ExactSettlementEngine (AH quarter-lines, OU, BTTS).
// 4. Calculates P&L and updates daily realized yield.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ProductionSettlementService } from '@/lib/ledger/productionSettlementService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleSettle(request);
}

export async function POST(request: NextRequest) {
  return handleSettle(request);
}

async function handleSettle(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const nowMs = Date.now();
  const todayStr = new Date(nowMs).toISOString().slice(0, 10);

  try {
    // 1. Lock and settle pending bets
    const settlementReport = await ProductionSettlementService.settlePendingBets(nowMs);

    // 2. Discover remaining unsettled count
    const ledger = DurableLedgerStore.loadLedger();
    const unsettledEntries = Object.values(ledger).filter(
      (e) => e.status === 'LOCKED' || e.status === 'AWAITING_RESULT' || e.status === 'RECORDED'
    );

    // 3. Update daily summary
    const todaySummary = await DailyPerformanceService.calculateDailySummary(todayStr);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      unsettledCount: unsettledEntries.length,
      settlementReport,
      todaySummary,
    });
  } catch (error: any) {
    console.error('[API /cron/settle-predictions] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown settlement error',
      },
      { status: 500 }
    );
  }
}
