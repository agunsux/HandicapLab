// EPIC 57 — Internal Shadow Performance API
// Location: src/app/api/admin/shadow-performance/route.ts
// Internal research-facing view tracking the 150-200 settlement gate.
// NO public value bets or EV% recommendations rendered.

import { NextResponse } from 'next/server';
import { DailyAhShadowPipeline, RESEARCH_HONESTY_BANNER } from '@/lib/pipeline/dailyAhShadowPipeline';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  try {
    const ledger = DailyAhShadowPipeline.loadLedger();
    const summary = DailyAhShadowPipeline.generatePipelineSummary();

    const settled = ledger.filter((r) => r.settlementStatus === 'SETTLED');
    const pending = ledger.filter((r) => r.settlementStatus === 'PENDING');
    const voided = ledger.filter((r) => r.settlementStatus === 'VOID');

    let won = 0;
    let halfWon = 0;
    let lost = 0;
    let halfLost = 0;
    let push = 0;
    let totalProfit = 0;

    for (const r of settled) {
      if (r.profitLoss !== undefined) totalProfit += r.profitLoss;
      if (r.actualOutcome === 'FULL_WIN') won++;
      else if (r.actualOutcome === 'HALF_WIN') halfWon++;
      else if (r.actualOutcome === 'FULL_LOSS') lost++;
      else if (r.actualOutcome === 'HALF_LOSS') halfLost++;
      else if (r.actualOutcome === 'PUSH') push++;
    }

    const settledCount = settled.length;
    const hitRate = settledCount > 0 ? ((won + halfWon) / settledCount) * 100 : 0;
    const realizedRoi = settledCount > 0 ? (totalProfit / settledCount) * 100 : 0;

    // Recent 50 predictions in the ledger
    const recentPredictions = ledger.slice(-50).reverse();

    return NextResponse.json({
      success: true,
      mode: 'SHADOW_INTERNAL_RESEARCH',
      monetizationEnabled: false,
      researchStatusBanner: RESEARCH_HONESTY_BANNER,
      monetizationGate: {
        currentSettledCount: settledCount,
        targetSettledGate: 175, // 150-200 window
        gateThresholdMet: settledCount >= 150,
        progressPct: summary.gateProgressPct,
      },
      performance: {
        totalGenerated: ledger.length,
        pendingCount: pending.length,
        settledCount,
        voidedCount: voided.length,
        won,
        halfWon,
        lost,
        halfLost,
        push,
        hitRatePct: Number(hitRate.toFixed(2)),
        totalProfitUnits: Number(totalProfit.toFixed(2)),
        realizedRoiPct: Number(realizedRoi.toFixed(2)),
        meanLiveClv: summary.meanLiveClv,
        liveClvZScore: summary.liveClvZScore,
      },
      recentPredictions,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
