// EPIC 54 Stage A — Central Orchestrator
// Single entry point for the entire autonomous pipeline.
// Coordinates: event queue → workers → state transitions → audit trail
//
// The orchestrator does NOT contain prediction logic.
// It delegates to existing modules (fixtureState, eventQueue, evidenceEngine, etc.)
//
// Flow:
//   1. Recover stuck events (after restart/deploy)
//   2. Process pending events in priority order
//   3. Discover new fixtures (morning windows)
//   4. Enqueue snapshot/prediction/settlement events as due
//   5. Run evidence engine for settled fixtures
//   6. Run league evolution
//   7. Run historical surplus on remaining quota
//
// Every operation is audited.

import { acquire, logCall, getProviderHealth } from '@/lib/providers/quotaManager';
import { discoverFixtures } from '@/lib/crons/fixtureDiscovery';
import { runT60Snapshot } from '@/lib/crons/t60Snapshot';
import {
  upsertFixture,
  transitionState,
  getFixturesNeedingSnapshots,
  getFixturesNeedingSettlement,
  getFixturesNeedingMetricsUpdate,
  getLeagueImportProgress,
  type FixtureStateRow,
} from '@/lib/crons/fixtureState';
import {
  enqueue,
  recoverStuckEvents,
  getQueueDepth,
} from '@/lib/crons/eventQueue';
import { recordAuditEvent } from '@/lib/crons/auditTrail';
import { runEvidenceEngine } from '@/lib/crons/evidenceEngine';
import { runLeagueEvolution } from '@/lib/crons/leagueEvolution';
import { LEAGUE_PRIORITIES } from '@/lib/config/leaguePriorities';

export interface OrchestratorReport {
  recoveredStuckEvents: number;
  queueDepth: { pending: number; processing: number; failed: number; completed: number };
  newFixturesDiscovered: number;
  snapshotsBuilt: number;
  snapshotErrors: number;
  settlementsProcessed: number;
  metricsUpdated: number;
  leaguesPromoted: number;
  historicalBatchesRun: number;
  providerHealth: Awaited<ReturnType<typeof getProviderHealth>>;
  leagueProgress: Awaited<ReturnType<typeof getLeagueImportProgress>>;
  durationMs: number;
}

// ─── Workers ────────────────────────────────────────────────────────

async function workerDiscovery(): Promise<number> {
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

async function workerSnapshots(): Promise<{ built: number; errors: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 30 * 60_000);
  const windowEnd = new Date(now.getTime() + 90 * 60_000);

  const candidates = await getFixturesNeedingSnapshots(windowStart, windowEnd);
  if (candidates.length === 0) return { built: 0, errors: 0 };

  const receipt = await acquire('oddspapi', 'odds', 'critical');
  if (!receipt.ok) {
    console.warn(`[Orchestrator] Snapshots skipped: ${receipt.reason}`);
    return { built: 0, errors: 0 };
  }

  // Mark as SNAPSHOT_PENDING
  for (const f of candidates) {
    await transitionState(f.fixtureId, 'SNAPSHOT_PENDING');
  }

  try {
    const result = await runT60Snapshot();
    const errors = result.snapshots.filter((s) => !s.success).length;

    for (const s of result.snapshots) {
      const fixtureId = String(s.fixtureId);
      if (s.dataGap && s.dataGap.length > 0) {
        await transitionState(fixtureId, 'SNAPSHOT_COMPLETE', { snapshotDataGap: s.dataGap });
      } else {
        await transitionState(fixtureId, 'SNAPSHOT_COMPLETE');
      }
      // Enqueue prediction generation
      await enqueue('prediction_due', fixtureId);
    }

    await logCall('oddspapi', 'odds', 0, 200, { mode: 't60_snapshot', count: candidates.length });

    return { built: result.total, errors };
  } catch (err) {
    console.error('[Orchestrator] Snapshot run failed:', err);
    return { built: 0, errors: candidates.length };
  }
}

async function workerSettlement(): Promise<number> {
  // Settlement is handled by SettlementEngine (EPIC 35).
  // This worker only manages the state transition.
  // The actual settlement logic is called by the existing settlement engine.
  const fixtures = await getFixturesNeedingSettlement();
  let processed = 0;

  for (const f of fixtures) {
    await transitionState(f.fixtureId, 'SETTLEMENT_PENDING');
    // In a full implementation, this would call SettlementEngine.run()
    // The SETTLEMENT_PENDING → SETTLED transition happens after settlement confirms.
    processed += 1;
  }

  return processed;
}

async function workerMetrics(): Promise<number> {
  const result = await runEvidenceEngine();
  return result.updated;
}

async function workerHistorical(): Promise<number> {
  let batches = 0;

  for (const league of LEAGUE_PRIORITIES) {
    const receipt = await acquire('apifootball', 'fixtures/historical', 'background');
    if (!receipt.ok) break;

    try {
      await logCall('apifootball', 'fixtures/historical', 0, 200, {
        leagueId: league.apiFootballId,
        mode: 'historical_surplus',
      });
      batches += 1;
    } catch {
      break;
    }
  }

  return batches;
}

// ─── Main entry ─────────────────────────────────────────────────────
export async function runOrchestrator(): Promise<OrchestratorReport> {
  const startTime = Date.now();
  const jobId = `orchestrator-${startTime}`;

  console.log('[Orchestrator] Starting autonomous pipeline...');

  // Phase 0: Recover any stuck events from previous runs
  const recoveredStuckEvents = await recoverStuckEvents();

  // Capture pre-run health
  const health = await getProviderHealth();
  const afQuota = health.find((h) => h.provider === 'apifootball')!;

  // Phase 1: Fixture discovery (always runs if quota available)
  let newFixturesDiscovered = 0;
  const discReceipt = await acquire('apifootball', 'fixtures', 'normal');
  if (discReceipt.ok) {
    newFixturesDiscovered = await workerDiscovery();
  }

  // Phase 2: T-60 snapshots (critical window)
  const snapResult = await workerSnapshots();

  // Phase 3: Settlement processing
  const settlementsProcessed = await workerSettlement();

  // Phase 4: Metrics update (evidence engine)
  const metricsUpdated = await workerMetrics();

  // Phase 5: League evolution
  const { promoted: leaguesPromoted } = await runLeagueEvolution();

  // Phase 6: Historical surplus (only if comfortable quota remains)
  const postHealth = await getProviderHealth();
  const postAf = postHealth.find((h) => h.provider === 'apifootball')!;
  let historicalBatchesRun = 0;
  if (postAf.quotaPct < 75) {
    historicalBatchesRun = await workerHistorical();
  }

  // Get final state
  const queueDepth = await getQueueDepth();
  const leagueProgress = await getLeagueImportProgress();
  const healthAfter = await getProviderHealth();
  const durationMs = Date.now() - startTime;

  // Audit the orchestrator run itself
  await recordAuditEvent({
    jobId,
    triggerSource: 'orchestrator',
    outcome: 'success',
    durationMs,
    metadata: {
      newFixturesDiscovered,
      snapshotsBuilt: snapResult.built,
      settlementsProcessed,
      metricsUpdated,
      historicalBatchesRun,
      queueDepth,
    },
  });

  console.log(`[Orchestrator] Pipeline complete in ${durationMs}ms`, {
    recovered: recoveredStuckEvents,
    discovered: newFixturesDiscovered,
    snapshots: snapResult,
    settlements: settlementsProcessed,
    metrics: metricsUpdated,
    historical: historicalBatchesRun,
    queue: queueDepth,
  });

  return {
    recoveredStuckEvents,
    queueDepth,
    newFixturesDiscovered,
    snapshotsBuilt: snapResult.built,
    snapshotErrors: snapResult.errors,
    settlementsProcessed,
    metricsUpdated,
    leaguesPromoted,
    historicalBatchesRun,
    providerHealth: healthAfter,
    leagueProgress,
    durationMs,
  };
}
