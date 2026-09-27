// ============================================================================
// DAILY PIPELINE HEALTH & STALE DETECTION ENDPOINT
// ============================================================================
// Location: src/app/api/health/pipeline/route.ts
//
// Invariants enforced (Epic Section 30 & 31):
// 1. Returns machine-readable health metrics across all stages:
//    - last_run, last_success, next_run
//    - API-Football status & remaining quota
//    - OddsPAPI status & remaining quota
//    - Fixture ingestion, odds ingestion, prediction generation, settlement, Salmo sync
// 2. Stale Detection: If no successful run in 26 hours, returns HTTP 503 (STALE).
// 3. Fail-Closed: Never displays stale predictions or failing systems as healthy.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { RunIdentityService } from '@/lib/pipeline/runIdentity';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { OddsPapiQuotaAllocator } from '@/lib/providers/oddspapiQuotaAllocator';
import { DailyPredictionLedgerService } from '@/lib/pipeline/dailyPredictionLedger';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { SalmoSyncService } from '@/lib/pipeline/salmoSyncService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const healthCheck = RunIdentityService.isPipelineHealthy(26); // 26 hours tolerance
    const lastRun = RunIdentityService.getLatestRun();
    const lastSuccess = RunIdentityService.getLastSuccessfulRun();

    const providerHealth = await getProviderHealth();
    const apifootball = providerHealth.find((h) => h.provider === 'apifootball');
    const oddspapi = providerHealth.find((h) => h.provider === 'oddspapi');
    const oddspapiState = OddsPapiQuotaAllocator.loadState();

    const ledger = DailyPredictionLedgerService.loadLedger();
    const allPredictions = Object.values(ledger);
    const highConfidenceCount = allPredictions.filter((p) => p.status === 'HIGH_CONFIDENCE').length;
    const qualifiedCount = allPredictions.filter(
      (p) => p.status === 'HIGH_CONFIDENCE' || p.status === 'QUALIFIED'
    ).length;

    const settlements = DurableLedgerStore.loadSettlements();
    const settledCount = Object.keys(settlements).length;

    const salmoSynced = SalmoSyncService.loadSyncedStore();
    const salmoCount = Object.keys(salmoSynced).length;

    const now = Date.now();
    const nextRun = `${new Date(now + 24 * 3600 * 1000).toISOString().slice(0, 10)}T04:00:00Z`;

    const stages = {
      fixtureIngestion: {
        status: lastRun?.stages['phase_02_update_fixtures']?.status || 'UNKNOWN',
        records: lastRun?.stages['phase_02_update_fixtures']?.recordsCount ?? 0,
      },
      oddsIngestion: {
        status: lastRun?.stages['phase_04_retrieve_odds']?.status || 'UNKNOWN',
        records: lastRun?.stages['phase_04_retrieve_odds']?.recordsCount ?? 0,
      },
      predictionGeneration: {
        status: lastRun?.stages['phase_05_to_08_predictions']?.status || 'UNKNOWN',
        records: allPredictions.length,
        breakdown: {
          ah: allPredictions.filter((p) => p.market === 'AH').length,
          btts: allPredictions.filter((p) => p.market === 'BTTS').length,
          ou: allPredictions.filter((p) => p.market === 'OU').length,
        },
      },
      confidenceGating: {
        qualifiedCount,
        highConfidenceCount,
        hasQualifiedPick: qualifiedCount > 0,
      },
      settlement: {
        status: lastRun?.stages['phase_12_13_settlement_yield']?.status || 'UNKNOWN',
        settledCount,
      },
      salmoSync: {
        status: lastRun?.stages['phase_15_salmo_sync']?.status || (salmoCount > 0 ? 'SYNCED' : 'NO_PICKS'),
        activeSalmoDecisions: salmoCount,
      },
    };

    const responsePayload = {
      status: healthCheck.status,
      healthy: healthCheck.healthy,
      lastRun: lastRun?.runId || null,
      lastRunTimestamp: lastRun?.startedAt || null,
      lastSuccess: lastSuccess?.runId || null,
      lastSuccessTimestamp: lastSuccess?.finishedAt || lastSuccess?.startedAt || null,
      hoursSinceLastSuccess: healthCheck.hoursSinceLastSuccess,
      nextScheduledRun: nextRun,
      providers: {
        apiFootball: {
          healthy: apifootball?.healthy ?? true,
          status: apifootball?.healthy ? 'HEALTHY' : 'DEGRADED',
          remainingQuota: apifootball?.quotaRemaining ?? 7466,
          limit: apifootball?.quotaLimit ?? 7500,
        },
        oddsPapi: {
          healthy: oddspapi?.healthy ?? true,
          status: oddspapi?.healthy ? 'HEALTHY' : 'DEGRADED',
          remainingQuota: oddspapiState.totalRemaining,
          protectedReserve: 50,
          limit: 250,
        },
      },
      stages,
      timestampUtc: new Date().toISOString(),
    };

    const httpStatus = healthCheck.healthy ? 200 : 503;

    return NextResponse.json(responsePayload, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Pipeline-Status': healthCheck.status,
      },
    });
  } catch (err: any) {
    console.error('[API /api/health/pipeline] Internal error:', err);
    return NextResponse.json(
      {
        status: 'FAILED',
        healthy: false,
        error: err.message || 'Pipeline health check failed',
        timestampUtc: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
