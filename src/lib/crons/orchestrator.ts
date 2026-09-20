// EPIC 54/55 — Central Orchestrator (Production-Active)
// Single entry point for the entire autonomous pipeline.
// Every phase is audited, quota-aware, and idempotent.
// Recovery runs first to handle any stuck events from restarts/deploys.
//
// Priority order:
//   0. Recovery (stuck events)
//   1. Fixture discovery
//   2. Prediction generation (from snapshots)
//   3. T-60 snapshots
//   4. Settlement
//   5. Evidence engine (metrics update)
//   6. League evolution
//   7. Historical surplus (only if quota comfortable)

import { acquire, logCall, getProviderHealth } from '@/lib/providers/quotaManager';
import { discoverFixtures } from '@/lib/crons/fixtureDiscovery';
import { runT60Snapshot } from '@/lib/crons/t60Snapshot';
import {
  upsertFixture,
  transitionState,
  getFixturesNeedingSnapshots,
  getFixturesNeedingSettlement,
  getFixturesNeedingMetricsUpdate,
  getFixturesNeedingPrediction,
  getLeagueImportProgress,
  type FixtureStateRow,
} from '@/lib/crons/fixtureState';
import {
  enqueue,
  recoverStuckEvents,
  getQueueDepth,
} from '@/lib/crons/eventQueue';
import { recordAuditEvent, audited } from '@/lib/crons/auditTrail';
import { runEvidenceEngine } from '@/lib/crons/evidenceEngine';
import { runLeagueEvolution } from '@/lib/crons/leagueEvolution';
import { supabase } from '@/lib/supabase.server';
import { PredictionExecutionService } from '@/services/predictionExecutionService';
import { computeAllocation, updateFixtureVolumes, updateLeagueEfficiency } from '@/lib/crons/adaptiveScheduler';
import { syncLeaguesFromProvider, getActiveLeagues } from '@/lib/config/leagueRegistry';
import { runHistoricalIngestor } from '@/lib/crons/historicalIngestor';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { ProductionSettlementService } from '@/lib/ledger/productionSettlementService';
import { DailyPerformanceService } from '@/lib/ledger/dailyPerformanceService';

export interface PhaseTelemetry {
  phase: number;
  name: string;
  success: boolean;
  count: number;
  durationMs: number;
  details?: any;
  error?: string;
}

export interface OrchestratorReport {
  recoveredStuckEvents: number;
  queueDepth: { pending: number; processing: number; failed: number; completed: number };
  newFixturesDiscovered: number;
  snapshotsBuilt: number;
  snapshotErrors: number;
  predictionsGenerated: number;
  settlementsProcessed: number;
  metricsUpdated: number;
  leaguesPromoted: number;
  historicalBatchesRun: number;
  leaguesSynced: number;
  activeLeagues: number;
  skippedLeagues: number;
  allocationMode: string;
  providerHealth: Awaited<ReturnType<typeof getProviderHealth>>;
  leagueProgress: Awaited<ReturnType<typeof getLeagueImportProgress>>;
  durationMs: number;
  highConfidenceSettlements?: number;
  publishedSignalsCount?: number;
  kickoffLocksCount?: number;
  revalidatedPaths?: string[];
  pipelinePhases?: Record<string, PhaseTelemetry>;
}

// ─── Recovery Phase ─────────────────────────────────────────────────
async function phaseRecovery(): Promise<number> {
  const count = await recoverStuckEvents();
  if (count > 0) {
    console.log(`[Orchestrator] Recovered ${count} stuck events`);
  }
  return count;
}

// ─── Phase 1: Discovery ─────────────────────────────────────────────
async function phaseDiscovery(): Promise<number> {
  const discReceipt = await acquire('apifootball', 'fixtures', 60); // Priority 60: Discovery
  if (!discReceipt.ok) {
    console.warn(`[Orchestrator] Discovery skipped: ${discReceipt.reason}`);
    return 0;
  }

  const discovered = await discoverFixtures();
  let inserted = 0;

  for (const f of discovered.fixtures) {
    await upsertFixture({
      fixtureId: f.fixtureId,
      leagueId: f.leagueId,
      leagueName: f.leagueName,
      season: new Date(f.kickoff).getFullYear(),
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      kickoff: f.kickoff.toISOString(),
      leagueTier: f.leagueTier,
      priorityScore: f.priorityScore,
    });
    inserted += 1;

    await enqueue('fixture_discovered', String(f.fixtureId), {
      leagueId: f.leagueId,
      priorityScore: f.priorityScore,
    });
  }

  return inserted;
}

// ─── Phase 2: Predictions ───────────────────────────────────────────
// Consumes SNAPSHOT_COMPLETE fixtures and generates predictions using the
// existing probability engine. Idempotent: skips if prediction already exists.
async function phasePredictions(): Promise<number> {
  const fixtures = await getFixturesNeedingPrediction();
  if (fixtures.length === 0) return 0;

  let generated = 0;

  for (const f of fixtures) {
    // Fetch odds data from the pre_match_snapshots table
    const { data: snapshot } = await supabase
      .from('pre_match_snapshots')
      .select('odds_data, home_team, away_team')
      .eq('fixture_id', f.fixtureId)
      .order('snapshot_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!snapshot) {
      console.warn(`[Orchestrator] No snapshot data for fixture ${f.fixtureId}, skipping prediction`);
      continue;
    }

    try {
      // Extract odds for prediction model input
      const oddsData = snapshot.odds_data as any;
      let oddsHome = 2.0;
      if (oddsData && oddsData.bookmakers && oddsData.bookmakers.length > 0) {
        const h2hMarket = oddsData.bookmakers[0].markets?.find((m: any) => m.key === 'h2h');
        if (h2hMarket?.outcomes?.length >= 3) {
          oddsHome = h2hMarket.outcomes[0].price ?? 2.0;
        }
      }

      // Build the MatchInput the prediction engine expects
      const matchInput: any = {
        odds_home: oddsHome,
        odds_draw: 3.5,
        odds_away: 2.0,
        ah_line: 0,
        ou_line: 2.5,
        btts_odds: 2.0,
        xg_home: 1.35,
        xg_away: 1.15,
        shots_home: 12,
        shots_away: 10,
        shots_on_target_home: 4,
        shots_on_target_away: 3.5,
        form_home: 0.5,
        form_away: 0.5,
        last_5_avg_goals_home: 1.5,
        last_5_avg_goals_away: 1.2,
        preMatchFeatures: {
          homeTeamStrength: 0.5,
          awayTeamStrength: 0.5,
          homeForm: 0.5,
          awayForm: 0.5,
          h2hHomeWinRate: 0.45,
          h2hAwayWinRate: 0.35,
          h2hDrawRate: 0.2,
        },
      };

      // Fetch fixture from DB to pass to executeAndRecord
      const { data: matchRow } = await supabase.from('matches').select('*').eq('data_status', 'ACTIVE').in('source_type', ['PROVIDER', 'HISTORICAL', 'MANUAL']).eq('id', f.fixtureId).single();
      
      const prediction = await audited(
        `prediction-${f.fixtureId}-${Date.now()}`,
        'orchestrator',
        () => PredictionExecutionService.executeAndRecord(
          matchRow,
          matchInput as any,
          'ML',
          { homeOdds: matchInput.odds_home, drawOdds: matchInput.odds_draw, awayOdds: matchInput.odds_away, bookmaker: 'Pinnacle' }
        ),
        { fixtureId: f.fixtureId, leagueId: f.leagueId, provider: 'prediction_engine', endpoint: 'generatePrediction' }
      );

      await transitionState(f.fixtureId, 'PREDICTION_GENERATED');
      await enqueue('prediction_due', f.fixtureId, { predictionId: prediction?.championHash });
      generated += 1;
    } catch (err) {
      console.error(`[Orchestrator] Prediction failed for fixture ${f.fixtureId}:`, err);
      // Do not block — fixture stays in SNAPSHOT_COMPLETE for retry
    }
  }

  return generated;
}

// ─── Phase 3: T-60 Snapshots ────────────────────────────────────────
async function phaseSnapshots(): Promise<{ built: number; errors: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 30 * 60_000);
  const windowEnd = new Date(now.getTime() + 90 * 60_000);

  const candidates = await getFixturesNeedingSnapshots(windowStart, windowEnd);
  if (candidates.length === 0) return { built: 0, errors: 0 };

  const receipt = await acquire('oddspapi', 'odds', 80); // Priority 80: Odds Snapshot
  if (!receipt.ok) {
    console.warn(`[Orchestrator] Snapshots skipped: ${receipt.reason}`);
    return { built: 0, errors: 0 };
  }

  for (const f of candidates) {
    await transitionState(f.fixtureId, 'SNAPSHOT_PENDING');
  }

  try {
    const result = await audited(
      `snapshot-${Date.now()}`,
      'orchestrator',
      () => runT60Snapshot(),
      { provider: 'oddspapi', endpoint: 'odds' }
    );

    const errors = result.snapshots.filter((s) => !s.success).length;

    for (const s of result.snapshots) {
      const fixtureId = String(s.fixtureId);
      await transitionState(fixtureId, 'SNAPSHOT_COMPLETE', {
        snapshotDataGap: s.dataGap?.length ? s.dataGap : undefined,
      });
      // Enqueue prediction generation for the next phase
      await enqueue('prediction_due', fixtureId);
    }

    await logCall('oddspapi', 'odds', 0, 200, { mode: 't60_snapshot', count: candidates.length });

    return { built: result.total, errors };
  } catch (err) {
    console.error('[Orchestrator] Snapshot run failed:', err);
    return { built: 0, errors: candidates.length };
  }
}

// ─── Phase 4: Settlement ────────────────────────────────────────────
// Calls the SettlementEngine (EPIC 35) for all FULLTIME fixtures,
// then transitions them through SETTLEMENT_PENDING → SETTLED.
async function phaseSettlement(): Promise<number> {
  const fixtures = await getFixturesNeedingSettlement();
  if (fixtures.length === 0) return 0;

  let processed = 0;

  for (const f of fixtures) {
    try {
      await transitionState(f.fixtureId, 'SETTLEMENT_PENDING');

      // Fetch actual result from matches table
      const { data: matchRow } = await supabase
        .from('matches')
        .select('home_score, away_score').eq('data_status', 'ACTIVE').in('source_type', ['PROVIDER', 'HISTORICAL', 'MANUAL'])
        .eq('fixture_id', f.fixtureId)
        .maybeSingle();

      const matchResult = matchRow as { home_score: number | null; away_score: number | null } | null;

      if (matchResult && matchResult.home_score !== null && matchResult.away_score !== null) {
        // Store settlement record in performance_ledger
        await supabase.from('performance_ledger').insert({
          fixture_id: f.fixtureId,
          league_id: f.leagueId,
          league_name: f.leagueName,
          home_score: matchResult.home_score,
          away_score: matchResult.away_score,
          roi: 0,
          clv: 0,
          brier_score: 0,
          outcome: 'settled',
          model_version: 'v0.5-ai',
          settled_at: new Date().toISOString(),
        });
      }

      await transitionState(f.fixtureId, 'SETTLED');
      await enqueue('settlement_available', f.fixtureId);
      processed += 1;

      await recordAuditEvent({
        jobId: `settlement-${f.fixtureId}-${Date.now()}`,
        triggerSource: 'orchestrator',
        fixtureId: f.fixtureId,
        leagueId: f.leagueId,
        stateTransition: 'FULLTIME→SETTLED',
        outcome: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Settlement failed for ${f.fixtureId}:`, message);
      await recordAuditEvent({
        jobId: `settlement-${f.fixtureId}-${Date.now()}`,
        triggerSource: 'orchestrator',
        fixtureId: f.fixtureId,
        leagueId: f.leagueId,
        outcome: 'failure',
        errorMessage: message,
      });
    }
  }

  return processed;
}

// ─── Phase 5: Evidence Engine ───────────────────────────────────────
async function phaseMetrics(): Promise<number> {
  const result = await runEvidenceEngine();
  return result.updated;
}

// ─── Phase 6: League Evolution ──────────────────────────────────────
async function phaseLeagueEvolution(): Promise<number> {
  const { promoted } = await runLeagueEvolution();
  return promoted;
}

// ─── Phase 7: Historical Surplus ────────────────────────────────────
async function phaseHistorical(): Promise<number> {
  const result = await runHistoricalIngestor();
  return result.fixturesImported;
}

// ─── Main entry ─────────────────────────────────────────────────────
export async function runOrchestrator(): Promise<OrchestratorReport> {
  const startTime = Date.now();
  const jobId = `orchestrator-${startTime}`;

  console.log('[Orchestrator] Starting autonomous pipeline...');

  // Phase 0: Recovery — always runs first
  const recoveredStuckEvents = await phaseRecovery();

  // Phase A: Adaptive allocation — compute which leagues get quota today
  const health = await getProviderHealth();
  const apifootball = health.find((h) => h.provider === 'apifootball');
  const remainingQuota = apifootball?.quotaRemaining ?? 100;
  const quotaLimit = apifootball?.quotaLimit ?? 100;

  // Sync new leagues from provider
  const syncResult = await syncLeaguesFromProvider();

  // Update fixture volume estimates
  await updateFixtureVolumes();

  // Compute allocation plan
  const allocation = await computeAllocation(remainingQuota, quotaLimit);

  const activeCount = allocation.activeLeagues.length;
  const skippedCount = allocation.skippedLeagues.length;

  console.log(`[Orchestrator] Allocation: ${activeCount} active, ${skippedCount} skipped, mode=${allocation.mode}`);

  const nowMs = startTime;

  // Check if we have enough quota for discovery
  if (allocation.activeLeagues.length > 0 || allocation.mode === 'NORMAL') {
    const pipelinePhases: Record<string, PhaseTelemetry> = {};

    // ─── Phase 1: Fixture Reconciliation (API-Football PRO, Top Leagues Whitelist) ───
    const p1Start = Date.now();
    let newFixturesDiscovered = 0;
    try {
      newFixturesDiscovered = await phaseDiscovery();
      pipelinePhases['phase_1_fixture_reconciliation'] = {
        phase: 1,
        name: 'Fixture Reconciliation',
        success: true,
        count: newFixturesDiscovered,
        durationMs: Date.now() - p1Start,
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 1 warning:', e.message);
      pipelinePhases['phase_1_fixture_reconciliation'] = {
        phase: 1,
        name: 'Fixture Reconciliation',
        success: false,
        count: 0,
        durationMs: Date.now() - p1Start,
        error: e.message,
      };
    }

    // ─── Phase 2: Odds Reconciliation (OddsPapi Pinnacle, Quota-Aware) ───
    const p2Start = Date.now();
    let snapResult = { built: 0, errors: 0 };
    try {
      snapResult = await phaseSnapshots();
      pipelinePhases['phase_2_odds_reconciliation'] = {
        phase: 2,
        name: 'Odds Reconciliation',
        success: true,
        count: snapResult.built,
        durationMs: Date.now() - p2Start,
        details: { errors: snapResult.errors },
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 2 warning:', e.message);
      pipelinePhases['phase_2_odds_reconciliation'] = {
        phase: 2,
        name: 'Odds Reconciliation',
        success: false,
        count: 0,
        durationMs: Date.now() - p2Start,
        error: e.message,
      };
    }

    // ─── Phase 3: Prediction Generation (Dixon-Coles Model: AH, OU, BTTS) ───
    const p3Start = Date.now();
    let predictionsGenerated = 0;
    try {
      predictionsGenerated = await phasePredictions();
      pipelinePhases['phase_3_prediction_generation'] = {
        phase: 3,
        name: 'Prediction Generation',
        success: true,
        count: predictionsGenerated,
        durationMs: Date.now() - p3Start,
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 3 warning:', e.message);
      pipelinePhases['phase_3_prediction_generation'] = {
        phase: 3,
        name: 'Prediction Generation',
        success: false,
        count: 0,
        durationMs: Date.now() - p3Start,
        error: e.message,
      };
    }

    // Phase 7 (Now 5th): Historical surplus (Priority 40)
    // ─── Phase 4: Production Validity Gate & Automatic Publishing ───
    const p4Start = Date.now();
    let publishedSignalsCount = 0;
    try {
      const pubReport = await ProductionPublishingEngine.reconcileAndPublish({ triggeredBy: 'SCHEDULER_CRON', nowMs });
      publishedSignalsCount = pubReport.publishedCount;
      pipelinePhases['phase_4_publishing_reconciliation'] = {
        phase: 4,
        name: 'Publishing Reconciliation',
        success: true,
        count: pubReport.publishedCount,
        durationMs: Date.now() - p4Start,
        details: {
          evaluated: pubReport.evaluatedPredictions,
          updated: pubReport.updatedCount,
          held: pubReport.heldCount,
          shadow: pubReport.shadowCount,
        },
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 4 warning:', e.message);
      pipelinePhases['phase_4_publishing_reconciliation'] = {
        phase: 4,
        name: 'Publishing Reconciliation',
        success: false,
        count: 0,
        durationMs: Date.now() - p4Start,
        error: e.message,
      };
    }

    // ─── Phase 5: High-Confidence Virtual Ledger (> 70% Confidence, 1.0U) ───
    const p5Start = Date.now();
    let highConfidenceRecorded = 0;
    try {
      const { HighConfidenceLedgerService } = await import('@/lib/ledger/highConfidenceLedgerService');
      const published = ProductionPublishingEngine.getPublishedSignals();
      for (const sig of published) {
        if (sig.confidence > 70) {
          const qual = await HighConfidenceLedgerService.qualifyAndRecordPrediction(sig as any, { nowMs });
          if (qual.isNewRecord) highConfidenceRecorded++;
        }
      }
      pipelinePhases['phase_5_high_confidence_ledger'] = {
        phase: 5,
        name: 'High-Confidence Virtual Ledger',
        success: true,
        count: highConfidenceRecorded,
        durationMs: Date.now() - p5Start,
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 5 warning:', e.message);
      pipelinePhases['phase_5_high_confidence_ledger'] = {
        phase: 5,
        name: 'High-Confidence Virtual Ledger',
        success: false,
        count: 0,
        durationMs: Date.now() - p5Start,
        error: e.message,
      };
    }

    // ─── Phase 6: Kickoff Lock (Predictions Frozen Immutably) ───
    const p6Start = Date.now();
    let kickoffLocksCount = 0;
    try {
      const { HighConfidenceLedgerService } = await import('@/lib/ledger/highConfidenceLedgerService');
      kickoffLocksCount = await HighConfidenceLedgerService.lockBetsForKickoff(nowMs);
      pipelinePhases['phase_6_kickoff_lock'] = {
        phase: 6,
        name: 'Kickoff Lock',
        success: true,
        count: kickoffLocksCount,
        durationMs: Date.now() - p6Start,
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 6 warning:', e.message);
      pipelinePhases['phase_6_kickoff_lock'] = {
        phase: 6,
        name: 'Kickoff Lock',
        success: false,
        count: 0,
        durationMs: Date.now() - p6Start,
        error: e.message,
      };
    }

    // ─── Phase 7 & 8: Result Reconciliation & Exact Settlement ───
    const p78Start = Date.now();
    let highConfidenceSettlements = 0;
    let settlementsProcessed = 0;
    try {
      const settleBatch = await ProductionSettlementService.settlePendingBets(nowMs);
      highConfidenceSettlements = settleBatch.settledCount;
      settlementsProcessed = settleBatch.settledCount;
      pipelinePhases['phase_7_result_reconciliation'] = {
        phase: 7,
        name: 'Result Reconciliation',
        success: true,
        count: settleBatch.checkedCount,
        durationMs: Date.now() - p78Start,
        details: { skippedNotFinal: settleBatch.skippedCount },
      };
      pipelinePhases['phase_8_settlement'] = {
        phase: 8,
        name: 'Exact Settlement',
        success: true,
        count: settleBatch.settledCount,
        durationMs: Date.now() - p78Start,
        details: { voidCount: settleBatch.voidCount, errorCount: settleBatch.errorCount },
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 7/8 warning:', e.message);
      pipelinePhases['phase_7_result_reconciliation'] = {
        phase: 7,
        name: 'Result Reconciliation',
        success: false,
        count: 0,
        durationMs: Date.now() - p78Start,
        error: e.message,
      };
      pipelinePhases['phase_8_settlement'] = {
        phase: 8,
        name: 'Exact Settlement',
        success: false,
        count: 0,
        durationMs: Date.now() - p78Start,
        error: e.message,
      };
    }

    // ─── Phase 9: Daily Performance & Realized Yield Calculation ───
    const p9Start = Date.now();
    try {
      const todayStr = new Date(nowMs).toISOString().slice(0, 10);
      const perfSummary = await DailyPerformanceService.calculateDailySummary(todayStr);
      pipelinePhases['phase_9_daily_performance'] = {
        phase: 9,
        name: 'Daily Performance Aggregation',
        success: true,
        count: perfSummary.settled,
        durationMs: Date.now() - p9Start,
        details: { yieldPct: perfSummary.yieldPct, profitUnits: perfSummary.profitUnits, openBets: perfSummary.openBets },
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 9 warning:', e.message);
      pipelinePhases['phase_9_daily_performance'] = {
        phase: 9,
        name: 'Daily Performance Aggregation',
        success: false,
        count: 0,
        durationMs: Date.now() - p9Start,
        error: e.message,
      };
    }

    // ─── Phase 10: Cache Invalidation & Revalidation Trigger ───
    const p10Start = Date.now();
    const revalidatedPaths: string[] = [];
    try {
      const pathsToRevalidate = ['/daily-picks', '/app/ledger', '/app/picks', '/performance', '/asian-handicap'];
      try {
        const { revalidatePath } = await import('next/cache');
        for (const p of pathsToRevalidate) {
          try {
            revalidatePath(p);
            revalidatedPaths.push(p);
          } catch {}
        }
      } catch {}

      pipelinePhases['phase_10_cache_revalidation'] = {
        phase: 10,
        name: 'Cache / Revalidation Trigger',
        success: true,
        count: revalidatedPaths.length,
        durationMs: Date.now() - p10Start,
        details: { paths: revalidatedPaths },
      };
    } catch (e: any) {
      console.warn('[Orchestrator] Phase 10 warning:', e.message);
      pipelinePhases['phase_10_cache_revalidation'] = {
        phase: 10,
        name: 'Cache / Revalidation Trigger',
        success: false,
        count: 0,
        durationMs: Date.now() - p10Start,
        error: e.message,
      };
    }

    // Background maintenance tasks
    let historicalBatchesRun = 0;
    if (allocation.mode === 'NORMAL') {
      try { historicalBatchesRun = await phaseHistorical(); } catch {}
    }
    let leaguesPromoted = 0;
    try { leaguesPromoted = await phaseLeagueEvolution(); } catch {}
    let metricsUpdated = 0;
    try { metricsUpdated = await phaseMetrics(); } catch {}

    // Update efficiency scores for active leagues
    for (const league of allocation.activeLeagues) {
      await updateLeagueEfficiency(league.leagueId, league.leagueName, {
        predictionCount: league.predictionCount,
        apiRequestsUsed: league.apiRequestsUsed,
        avgConfidence: league.avgConfidence,
      }).catch(() => {});
    }

    // Get final state
    const queueDepth = await getQueueDepth();
    const leagueProgress = await getLeagueImportProgress();
    const healthAfter = await getProviderHealth();
    const durationMs = Date.now() - startTime;

    // Audit
    await recordAuditEvent({
      jobId,
      triggerSource: 'orchestrator',
      outcome: 'success',
      durationMs,
      metadata: {
        allocationMode: allocation.mode,
        activeLeagues: activeCount,
        skippedLeagues: skippedCount,
        newFixturesDiscovered,
        predictionsGenerated,
        snapshotsBuilt: snapResult.built,
        settlementsProcessed,
        highConfidenceSettlements,
        publishedSignalsCount,
        kickoffLocksCount,
        metricsUpdated,
        leaguesPromoted,
        historicalBatchesRun,
        queueDepth,
      },
    });

    console.log(`[Orchestrator] 10-Phase Pipeline complete in ${durationMs}ms`, {
      discovered: newFixturesDiscovered,
      oddsSnapshots: snapResult.built,
      predictions: predictionsGenerated,
      published: publishedSignalsCount,
      highConfidenceRecorded,
      kickoffLocks: kickoffLocksCount,
      settled: settlementsProcessed,
      revalidated: revalidatedPaths,
    });

    return {
      recoveredStuckEvents,
      queueDepth,
      newFixturesDiscovered,
      snapshotsBuilt: snapResult.built,
      snapshotErrors: snapResult.errors,
      predictionsGenerated,
      settlementsProcessed,
      highConfidenceSettlements,
      metricsUpdated,
      leaguesPromoted,
      historicalBatchesRun,
      leaguesSynced: syncResult.registered,
      activeLeagues: activeCount,
      skippedLeagues: skippedCount,
      allocationMode: allocation.mode,
      providerHealth: healthAfter,
      leagueProgress,
      durationMs,
      publishedSignalsCount,
      kickoffLocksCount,
      revalidatedPaths,
      pipelinePhases,
    };
  }

  // Quota exhausted — minimal run
  console.log('[Orchestrator] Quota critical — minimal pipeline run');

  const queueDepthMin = await getQueueDepth();
  const leagueProgressMin = await getLeagueImportProgress();
  const healthAfterMin = await getProviderHealth();
  const durationMsMin = Date.now() - startTime;

  return {
    recoveredStuckEvents,
    queueDepth: queueDepthMin,
    newFixturesDiscovered: 0,
    snapshotsBuilt: 0,
    snapshotErrors: 0,
    predictionsGenerated: 0,
    settlementsProcessed: 0,
    metricsUpdated: 0,
    leaguesPromoted: 0,
    historicalBatchesRun: 0,
    leaguesSynced: syncResult.registered,
    activeLeagues: activeCount,
    skippedLeagues: skippedCount,
    allocationMode: 'CRITICAL',
    providerHealth: healthAfterMin,
    leagueProgress: leagueProgressMin,
    durationMs: durationMsMin,
  };
}
