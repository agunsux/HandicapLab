// EPIC 54/55 — Autonomous Pipeline & Cron Consolidation Route
// Location: src/app/api/cron/pipeline/route.ts
// Consolidates:
//   - mode=full (default): Central Orchestrator coordinating all pipeline stages
//   - mode=health: Provider, queue, and league progress telemetry
//   - mode=queue: Queue depth telemetry
//   - mode=reconcile | publishing-reconcile: ProductionPublishingEngine reconciliation & SALMO publishing
//   - mode=settle | settle-predictions: ProductionSettlementService bet settlement & daily realized yield

import { NextResponse, type NextRequest } from 'next/server';
import { runOrchestrator } from '@/lib/crons/orchestrator';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { getQueueDepth } from '@/lib/crons/eventQueue';
import { getLeagueImportProgress } from '@/lib/crons/fixtureState';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { ProductionSettlementService } from '@/lib/ledger/productionSettlementService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';

const WINDOW_LABELS: Record<number, string> = {
  6: 'morning',
  12: 't120_prelineup',
  18: 't60_lineups',
  22: 'postmatch',
};

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const token = request.nextUrl.searchParams.get('token');
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('mode') || 'full';
  const hour = new Date().getUTCHours();
  const windowLabel = WINDOW_LABELS[hour] ?? `hour_${hour}`;

  // 1. Publishing Reconciliation mode (absorbed from /api/cron/publishing-reconcile)
  if (mode === 'reconcile' || mode === 'publishing-reconcile') {
    const forceRefresh = searchParams.get('force') === 'true' || searchParams.get('refresh') === 'true';
    try {
      const report = await ProductionPublishingEngine.reconcileAndPublish({
        triggeredBy: 'SCHEDULER_CRON',
        forceRefresh,
      });
      return NextResponse.json({
        success: true,
        message: 'Automatic production publishing reconciliation complete.',
        report,
      });
    } catch (error: any) {
      console.error('[Pipeline Cron - Reconcile] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Reconciliation failed',
        },
        { status: 500 }
      );
    }
  }

  // 2. High-Confidence Settlement mode (absorbed from /api/cron/settle-predictions)
  if (mode === 'settle' || mode === 'settle-predictions') {
    const nowMs = Date.now();
    const todayStr = new Date(nowMs).toISOString().slice(0, 10);
    try {
      const settlementReport = await ProductionSettlementService.settlePendingBets(nowMs);
      const ledger = DurableLedgerStore.loadLedger();
      const unsettledEntries = Object.values(ledger).filter(
        (e) => e.status === 'LOCKED' || e.status === 'AWAITING_RESULT' || e.status === 'RECORDED'
      );
      const todaySummary = await DailyPerformanceService.calculateDailySummary(todayStr);

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        unsettledCount: unsettledEntries.length,
        settlementReport,
        todaySummary,
      });
    } catch (error: any) {
      console.error('[Pipeline Cron - Settle] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Unknown settlement error',
        },
        { status: 500 }
      );
    }
  }

  // 3. Telemetry health mode
  if (mode === 'health') {
    const [health, queue, progress] = await Promise.all([
      getProviderHealth(),
      getQueueDepth(),
      getLeagueImportProgress(),
    ]);
    return NextResponse.json({ success: true, data: { providers: health, queue, leagueProgress: progress } });
  }

  // 4. Telemetry queue mode
  if (mode === 'queue') {
    const queue = await getQueueDepth();
    return NextResponse.json({ success: true, data: queue });
  }

  // 5. Full Orchestrator execution (default cron pipeline)
  console.log(`[Pipeline Cron] Triggered at UTC ${hour}:00 (window: ${windowLabel})`);
  try {
    const report = await runOrchestrator();
    return NextResponse.json({ success: true, window: windowLabel, result: report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Pipeline Cron] Fatal:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
