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
import { PredictionArchiveService } from '@/lib/archive/predictionArchiveService';
import { ReconciliationService } from '@/lib/archive/reconciliationService';
import { ModelVersionRegistry } from '@/lib/archive/modelVersionRegistry';
import { DistributedCronLease } from '@/lib/crons/distributedCronLease';

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

  const isMutationMode = ['full', 'reconcile', 'publishing-reconcile', 'settle', 'settle-predictions', 'sync', 'salmo-sync'].includes(mode);
  let leaseId: string | undefined;

  if (isMutationMode) {
    const lease = await DistributedCronLease.acquireLease(`cron_${mode}`, 5 * 60 * 1000);
    if (!lease.acquired) {
      return NextResponse.json({
        success: false,
        message: 'Concurrent cron execution skipped',
        reason: lease.reason,
      }, { status: 409 });
    }
    leaseId = lease.leaseId;
  }

  try {

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

  // 3. Canonical Sync & Rollover Mode
  if (mode === 'sync' || mode === 'salmo-sync') {
    try {
      const nowMs = Date.now();
      const lockedCount = await PredictionArchiveService.lockKickedOffPredictions(nowMs);
      const snapshot = PredictionArchiveService.generateDailyPicksSnapshot(nowMs);
      const reconciliation = ReconciliationService.reconcileArchive();

      return NextResponse.json({
        success: true,
        timestamp: new Date(nowMs).toISOString(),
        lockedKickoffCount: lockedCount,
        dailyPicksSnapshot: {
          runId: snapshot.runId,
          runTimestamp: snapshot.runTimestamp,
          actionablePicks: snapshot.actionablePicks,
          predictionsGenerated: snapshot.predictionsGenerated,
        },
        reconciliation: {
          isConsistent: reconciliation.isConsistent,
          discrepancyCount: reconciliation.discrepancies.length,
        },
      });
    } catch (error: any) {
      console.error('[Pipeline Cron - Sync] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Sync failed' },
        { status: 500 }
      );
    }
  }

  // 4. Zero-Data Contradiction Check Mode
  if (mode === 'contradiction-check' || mode === 'contradiction') {
    try {
      const nowMs = Date.now();
      const archive = PredictionArchiveService.loadArchive();
      const records = Object.values(archive);
      const upcomingRecords = records.filter((r) => new Date(r.kickoffTimestamp).getTime() > nowMs);
      const settledRecords = records.filter((r) => r.status === 'SETTLED' || r.status === 'VOID');
      const dailyPicks = PredictionArchiveService.getDailyPicksProjection({ nowMs });
      const performance = DailyPerformanceService.getArchivePerformanceReport({ nowMs });

      const contradictions: Array<{ code: string; message: string; severity: 'CRITICAL' | 'WARNING' }> = [];

      if (upcomingRecords.length === 0 && dailyPicks.length > 0) {
        contradictions.push({
          code: 'ZERO_FIXTURES_ACTIVE_SIGNALS',
          message: `Detected 0 upcoming fixtures but ${dailyPicks.length} active daily picks!`,
          severity: 'CRITICAL',
        });
      }

      if (settledRecords.length === 0 && performance.allTimeYieldPct > 0) {
        contradictions.push({
          code: 'ZERO_SETTLED_POSITIVE_YIELD',
          message: `Detected 0 settled predictions but positive realized yield (${performance.allTimeYieldPct}%)!`,
          severity: 'CRITICAL',
        });
      }

      const modelVerification = ModelVersionRegistry.verifyModelConfiguration('dixon-coles-v1.0');

      return NextResponse.json({
        success: true,
        status: contradictions.length === 0 ? 'HEALTHY' : 'CONTRADICTION_DETECTED',
        timestamp: new Date(nowMs).toISOString(),
        contradictions,
        modelIntegrity: {
          modelVersion: 'dixon-coles-v1.0',
          verified: modelVerification.verified,
        },
        summary: {
          totalArchived: records.length,
          upcomingCount: upcomingRecords.length,
          dailyPicksCount: dailyPicks.length,
          settledCount: settledRecords.length,
          allTimeYieldPct: performance.allTimeYieldPct,
        },
      });
    } catch (error: any) {
      console.error('[Pipeline Cron - ContradictionCheck] Error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Contradiction check failed' },
        { status: 500 }
      );
    }
  }

  // 5. Telemetry health mode
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

  // 5. Full Observability Mode (Section 18 Operational View)
  if (mode === 'observability' || mode === 'status') {
    const health = await getProviderHealth();
    const store = ProductionPublishingEngine.loadStore();
    const signals = Object.values(store);
    const ledger = DurableLedgerStore.loadLedger();
    const entries = Object.values(ledger);
    const settlements = DurableLedgerStore.loadSettlements();
    const todayStr = new Date().toISOString().slice(0, 10);
    const perfSummary = await DailyPerformanceService.calculateDailySummary(todayStr);

    const observabilityData = {
      timestampUtc: new Date().toISOString(),
      fixtures: {
        totalSignalsCount: signals.length,
        activeUpcomingCount: signals.filter((s) => new Date(s.kickoffUtc).getTime() > Date.now()).length,
      },
      odds: {
        cachedSnapshots: signals.filter((s) => s.currentOdds > 1).length,
        staleSnapshots: signals.filter((s) => s.validityStatus === 'STALE').length,
        provider: 'OddsPapi-Pinnacle',
      },
      predictions: {
        total: signals.length,
        published: signals.filter((s) => s.publishState === 'PUBLISHED').length,
        held: signals.filter((s) => s.publishState === 'HELD').length,
        shadow: signals.filter((s) => s.publishState === 'SHADOW').length,
        valid: signals.filter((s) => s.validityStatus === 'VALID').length,
      },
      ledger: {
        totalVirtualBets: entries.length,
        recorded: entries.filter((e) => e.status === 'RECORDED').length,
        locked: entries.filter((e) => e.status === 'LOCKED').length,
        awaitingResult: entries.filter((e) => e.status === 'AWAITING_RESULT').length,
        settled: entries.filter((e) => e.status === 'SETTLED').length,
        dataErrors: entries.filter((e) => e.status === 'DATA_ERROR').length,
      },
      settlement: {
        totalSettledRecords: Object.keys(settlements).length,
        wins: entries.filter((e) => settlements[e.ledgerId]?.outcome === 'WIN').length,
        halfWins: entries.filter((e) => settlements[e.ledgerId]?.outcome === 'HALF_WIN').length,
        pushes: entries.filter((e) => settlements[e.ledgerId]?.outcome === 'PUSH').length,
        halfLosses: entries.filter((e) => settlements[e.ledgerId]?.outcome === 'HALF_LOSS').length,
        losses: entries.filter((e) => settlements[e.ledgerId]?.outcome === 'LOSS').length,
        voids: entries.filter((e) => settlements[e.ledgerId]?.outcome === 'VOID').length,
      },
      performance: {
        settledStakeUnits: perfSummary.stakeUnits,
        profitUnits: perfSummary.profitUnits,
        realizedYieldPct: perfSummary.yieldPct,
        openExposureUnits: perfSummary.openStakeUnits,
        openBetsCount: perfSummary.openBets,
        strikeRatePct: perfSummary.strikeRatePct,
      },
      providerHealth: {
        apiFootball: health.find((h) => h.provider === 'apifootball') || { healthy: false, error: 'NO_HEALTH_RECORD' },
        oddsPapi: health.find((h) => h.provider === 'oddspapi') || { healthy: false, error: 'NO_HEALTH_RECORD' },
      },
    };

    return NextResponse.json({
      success: true,
      observability: observabilityData,
    });
  }

  // 5. Ops Dashboard mode (absorbed from /api/ops/dashboard)
  if (mode === 'ops' || mode === 'dashboard') {
    const { getRecentAuditEvents, getAuditSummary } = await import('@/lib/crons/auditTrail');
    const { getAllLeagueProfiles } = await import('@/lib/crons/leagueEvolution');
    const [
      providerHealth,
      queueDepth,
      leagueProgress,
      auditSummary,
      auditEvents,
      leagueProfiles,
    ] = await Promise.all([
      getProviderHealth(),
      getQueueDepth(),
      getLeagueImportProgress(),
      getAuditSummary(),
      getRecentAuditEvents(20),
      getAllLeagueProfiles(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        system: {
          scheduler: { healthy: true },
          queue: queueDepth,
          audit: auditSummary,
          recentEvents: auditEvents,
        },
        providers: providerHealth,
        predictions: {
          leagueProgress,
          totalFixtures: leagueProgress.reduce((acc, l) => acc + l.total, 0),
          totalSettled: leagueProgress.reduce((acc, l) => acc + l.settled, 0),
        },
        evidence: {
          leagues: leagueProfiles.map((l) => ({
            leagueId: l.leagueId,
            leagueName: l.leagueName,
            certification: l.certification,
            roi: l.roi,
            clv: l.clv,
            winRate: l.winRate,
            calibrationBrier: l.calibrationBrier,
            settledMatches: l.settledMatches,
            totalFixtures: l.totalFixturesInSeason,
          })),
        },
      },
    });
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
} finally {
  if (leaseId) {
    await DistributedCronLease.releaseLease(`cron_${mode}`, leaseId);
  }
}
}

export async function POST(request: NextRequest) {
  return GET(request);
}
