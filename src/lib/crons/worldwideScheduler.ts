// EPIC 53 Stage C — Worldwide Fixture Scheduler (v2)
// 4 daily windows: morning → T-120 pre-lineup → T-60 lineups → post-match analysis
// Orchestrates the pipeline by reading fixture_states — does NOT re-discover every run.
// Every external call goes through QuotaManager.acquire().
//
// Snapshot Dependency Graph: each source is tracked independently.
// If weather fails, snapshot completes with data_gap = ['weather'].

import { discoverFixtures, type ScoredFixture } from '@/lib/crons/fixtureDiscovery';
import { runT60Snapshot } from '@/lib/crons/t60Snapshot';
import { acquire, logCall, getProviderHealth } from '@/lib/providers/quotaManager';
import {
  upsertFixture,
  transitionState,
  markSnapshotDependency,
  getFixturesByState,
  getFixturesNeedingSnapshots,
  getFixturesNeedingPostMatch,
  getLeagueImportProgress,
  type FixtureState,
  type FixtureStateRow,
} from '@/lib/crons/fixtureState';
import { LEAGUE_PRIORITIES } from '@/lib/config/leaguePriorities';

export interface SchedulerResult {
  window: number;
  fixturesDiscovered: number;
  fixturesNewlyInserted: number;
  snapshotsBuilt: number;
  snapshotErrors: number;
  snapshotDependencyGaps: Record<string, number>;
  postMatchAnalysed: number;
  historicalBatchesRun: number;
  quotaBefore: { apifootball: { used: number; rem: number; pct: number }; oddspapi: { used: number; rem: number; pct: number } };
  quotaAfter: { apifootball: { used: number; rem: number; pct: number }; oddspapi: { used: number; rem: number; pct: number } };
  providerHealth: Awaited<ReturnType<typeof getProviderHealth>>;
  leagueProgress: Awaited<ReturnType<typeof getLeagueImportProgress>>;
}

const DAILY_WINDOWS = 4;

function currentWindow(): number {
  const h = new Date().getUTCHours();
  if (h < 8) return 0;   // morning discovery
  if (h < 14) return 1;  // T-120 pre-lineup
  if (h < 20) return 2;  // T-60 lineups
  return 3;               // post-match analysis
}

// ─── Phase 1: Discover new fixtures ─────────────────────────────────
async function phaseDiscovery(): Promise<{ fixtures: ScoredFixture[]; newlyInserted: number }> {
  const discovered = await discoverFixtures();
  let newlyInserted = 0;

  for (const f of discovered.fixtures) {
    await upsertFixture(f);
    newlyInserted += 1;
  }

  return { fixtures: discovered.fixtures, newlyInserted };
}

// ─── Phase 2: T-60 snapshots ────────────────────────────────────────
async function phaseSnapshots(): Promise<{
  built: number;
  errors: number;
  dependencyGaps: Record<string, number>;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 30 * 60_000);
  const windowEnd = new Date(now.getTime() + 90 * 60_000);

  // Get fixtures in critical T-30 to T-90 window
  const candidates = await getFixturesNeedingSnapshots(windowStart, windowEnd);
  if (candidates.length === 0) return { built: 0, errors: 0, dependencyGaps: {} };

  // Check quota before running snapshots (critical priority)
  const receipt = await acquire('oddspapi', 'odds', 'critical');
  if (!receipt.ok) {
    console.warn(`[Scheduler] Snapshots skipped: ${receipt.reason}`);
    return { built: 0, errors: 0, dependencyGaps: {} };
  }

  // Mark fixtures as SNAPSHOT_READY
  for (const f of candidates) {
    await transitionState(f.fixtureId, 'SNAPSHOT_READY');
  }

  try {
    const result = await runT60Snapshot();
    const errors = result.snapshots.filter((s) => !s.success).length;

    // Update dependency graph for each fixture
    const dependencyGaps: Record<string, number> = {};
    for (const s of result.snapshots) {
      const fixtureId = String(s.fixtureId ?? s.homeTeam + '_' + s.awayTeam);
      if (s.dataGap && s.dataGap.length > 0) {
        for (const gap of s.dataGap) {
          dependencyGaps[gap] = (dependencyGaps[gap] ?? 0) + 1;
          await markSnapshotDependency(fixtureId, gap as any, 'missing');
        }
        await transitionState(fixtureId, 'SNAPSHOT_READY', { snapshotDataGap: s.dataGap });
      } else {
        await markSnapshotDependency(fixtureId, 'odds', 'ok');
        await markSnapshotDependency(fixtureId, 'weather', 'ok');
        await markSnapshotDependency(fixtureId, 'injuries', 'ok');
        await markSnapshotDependency(fixtureId, 'lineups', 'ok');
        await markSnapshotDependency(fixtureId, 'rivalry', 'ok');
      }
    }

    await logCall('oddspapi', 'odds', 0, 200, { mode: 't60_snapshot', count: candidates.length });

    return { built: result.total, errors, dependencyGaps };
  } catch (err) {
    console.error('[Scheduler] Snapshot run failed:', err);
    return { built: 0, errors: candidates.length, dependencyGaps: {} };
  }
}

// ─── Phase 3: Post-match analysis ───────────────────────────────────
async function phasePostMatch(): Promise<number> {
  const finished = await getFixturesNeedingPostMatch();
  let analysed = 0;

  for (const f of finished) {
    const receipt = await acquire('apifootball', 'fixtures/postmatch', 'normal');
    if (!receipt.ok) break;

    try {
      // Transition FINISHED → SETTLED (settlement already handled by EPIC 31)
      await transitionState(f.fixtureId, 'SETTLED');
      analysed += 1;
    } catch {
      break;
    }
  }

  return analysed;
}

// ─── Phase 4: Historical surplus ────────────────────────────────────
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
export async function runWorldwideScheduler(): Promise<SchedulerResult> {
  const windowIdx = currentWindow();
  console.log(`[WorldwideScheduler] Window ${windowIdx + 1}/${DAILY_WINDOWS} starting...`);

  // Capture pre-run state
  const health = await getProviderHealth();
  const apifootballHealth = health.find((h) => h.provider === 'apifootball')!;
  const oddspapiHealth = health.find((h) => h.provider === 'oddspapi')!;

  const quotaBefore = {
    apifootball: { used: apifootballHealth.quotaUsed, rem: apifootballHealth.quotaRemaining, pct: apifootballHealth.quotaPct },
    oddspapi: { used: oddspapiHealth.quotaUsed, rem: oddspapiHealth.quotaRemaining, pct: oddspapiHealth.quotaPct },
  };

  // Phase 1: Discovery (windows 0 and 1 — morning and T-120)
  let fixturesDiscovered = 0;
  let fixturesNewlyInserted = 0;
  if (windowIdx <= 1) {
    const d = await phaseDiscovery();
    fixturesDiscovered = d.fixtures.length;
    fixturesNewlyInserted = d.newlyInserted;
  }

  // Phase 2: T-60 snapshots (windows 1 and 2 — pre-lineup and lineup)
  let snapshotsBuilt = 0;
  let snapshotErrors = 0;
  let snapshotDependencyGaps: Record<string, number> = {};
  if (windowIdx >= 1 && windowIdx <= 2) {
    const s = await phaseSnapshots();
    snapshotsBuilt = s.built;
    snapshotErrors = s.errors;
    snapshotDependencyGaps = s.dependencyGaps;
  }

  // Phase 3: Post-match analysis (window 3 only)
  let postMatchAnalysed = 0;
  if (windowIdx === 3) {
    postMatchAnalysed = await phasePostMatch();
  }

  // Phase 4: Historical surplus (any window, but only if quota > 25% remaining after earlier phases)
  let historicalBatchesRun = 0;
  const postHealth = await getProviderHealth();
  const postApifootball = postHealth.find((h) => h.provider === 'apifootball')!;
  if (postApifootball.quotaPct < 75) {
    historicalBatchesRun = await phaseHistorical();
  }

  // Capture post-run state
  const healthAfter = await getProviderHealth();
  const afAfter = healthAfter.find((h) => h.provider === 'apifootball')!;
  const opAfter = healthAfter.find((h) => h.provider === 'oddspapi')!;
  const quotaAfter = {
    apifootball: { used: afAfter.quotaUsed, rem: afAfter.quotaRemaining, pct: afAfter.quotaPct },
    oddspapi: { used: opAfter.quotaUsed, rem: opAfter.quotaRemaining, pct: opAfter.quotaPct },
  };

  const leagueProgress = await getLeagueImportProgress();

  console.log(`[WorldwideScheduler] Window ${windowIdx + 1} complete`, {
    discovered: fixturesDiscovered,
    new: fixturesNewlyInserted,
    snapshotsBuilt,
    snapshotErrors,
    dependencyGaps: snapshotDependencyGaps,
    postMatch: postMatchAnalysed,
    historical: historicalBatchesRun,
    quota: `AF: ${afAfter.quotaUsed}/${afAfter.quotaLimit} (${afAfter.quotaPct}%), OP: ${opAfter.quotaUsed}/${opAfter.quotaLimit} (${opAfter.quotaPct}%)`,
  });

  return {
    window: windowIdx + 1,
    fixturesDiscovered,
    fixturesNewlyInserted,
    snapshotsBuilt,
    snapshotErrors,
    snapshotDependencyGaps,
    postMatchAnalysed,
    historicalBatchesRun,
    quotaBefore,
    quotaAfter,
    providerHealth: healthAfter,
    leagueProgress,
  };
}
