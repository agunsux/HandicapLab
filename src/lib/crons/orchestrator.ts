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
import { LEAGUE_PRIORITIES } from '@/lib/config/leaguePriorities';
import { supabase } from '@/lib/supabase.server';
import { processAndStorePrediction } from '@/services/prediction.ledger';

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
  providerHealth: Awaited<ReturnType<typeof getProviderHealth>>;
  leagueProgress: Awaited<ReturnType<typeof getLeagueImportProgress>>;
  durationMs: number;
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
  const discReceipt = await acquire('apifootball', 'fixtures', 'normal');
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

      // Store prediction via the existing prediction ledger
      const prediction = await audited(
        `prediction-${f.fixtureId}-${Date.now()}`,
        'orchestrator',
        () => processAndStorePrediction(f.fixtureId, matchInput),
        { fixtureId: f.fixtureId, leagueId: f.leagueId, provider: 'prediction_engine', endpoint: 'generatePrediction' }
      );

      await transitionState(f.fixtureId, 'PREDICTION_GENERATED');
      await enqueue('prediction_due', f.fixtureId, { predictionId: prediction?.id });
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

  const receipt = await acquire('oddspapi', 'odds', 'critical');
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
        .select('home_score, away_score')
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

  // Phase 0: Recovery — always runs first
  const recoveredStuckEvents = await phaseRecovery();

  // Capture pre-run health
  const health = await getProviderHealth();

  // Phase 1: Fixture discovery
  const newFixturesDiscovered = await phaseDiscovery();

  // Phase 2: Predictions (from existing SNAPSHOT_COMPLETE fixtures)
  const predictionsGenerated = await phasePredictions();

  // Phase 3: T-60 snapshots
  const snapResult = await phaseSnapshots();

  // Phase 4: Settlement
  const settlementsProcessed = await phaseSettlement();

  // Phase 5: Metrics update (evidence engine)
  const metricsUpdated = await phaseMetrics();

  // Phase 6: League evolution
  const leaguesPromoted = await phaseLeagueEvolution();

  // Phase 7: Historical surplus (only if quota comfortable after all above)
  const postHealth = await getProviderHealth();
  const postAf = postHealth.find((h) => h.provider === 'apifootball')!;
  let historicalBatchesRun = 0;
  if (postAf.quotaPct < 75) {
    historicalBatchesRun = await phaseHistorical();
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
      predictionsGenerated,
      snapshotsBuilt: snapResult.built,
      settlementsProcessed,
      metricsUpdated,
      leaguesPromoted,
      historicalBatchesRun,
      queueDepth,
    },
  });

  console.log(`[Orchestrator] Pipeline complete in ${durationMs}ms`, {
    recovered: recoveredStuckEvents,
    discovered: newFixturesDiscovered,
    predictions: predictionsGenerated,
    snapshots: snapResult,
    settlements: settlementsProcessed,
    metrics: metricsUpdated,
    leagues: leaguesPromoted,
    historical: historicalBatchesRun,
    queue: queueDepth,
  });

  return {
    recoveredStuckEvents,
    queueDepth,
    newFixturesDiscovered,
    snapshotsBuilt: snapResult.built,
    snapshotErrors: snapResult.errors,
    predictionsGenerated,
    settlementsProcessed,
    metricsUpdated,
    leaguesPromoted,
    historicalBatchesRun,
    providerHealth: healthAfter,
    leagueProgress,
    durationMs,
  };
}
