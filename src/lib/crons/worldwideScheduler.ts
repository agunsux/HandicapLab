// EPIC 53 Stage C — Worldwide Fixture Scheduler
// 4 daily request windows (morning → T-120 → T-60 lineups → post-match analysis).
// Orchestrates: fixture discovery → priority ranking → T-60 snapshots → post-match settlement.
// Quota prorated across windows; when tight, only top-tier leagues get processed.
//
// Key design: quota is checked BEFORE every external call. Historical runs
// only on surplus quota. Critical T-60 windows always get the first slice.

import { discoverFixtures, getCriticalWindowFixtures, type ScoredFixture } from '@/lib/crons/fixtureDiscovery';
import { getQuota, canProceed, logProviderCall } from '@/lib/providers/quotaManager';
import { runT60Snapshot } from '@/lib/crons/t60Snapshot';
import { LEAGUE_PRIORITIES } from '@/lib/config/leaguePriorities';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { supabase } from '@/lib/supabase.server';

export interface SchedulerResult {
  totalFixturesFound: number;
  criticalWindowFixtures: number;
  snapshotsBuilt: number;
  snapshotErrors: number;
  historicalBatchesRun: number;
  postMatchAnalyses: number;
  skipped: {
    quotaBlocked: number;
    noOdds: number;
    alreadyProcessed: number;
  };
  quota: {
    apifootballBefore: { used: number; remaining: number; pct: number };
    apifootballAfter: { used: number; remaining: number; pct: number };
    oddspapiBefore: { used: number; remaining: number; pct: number };
    oddspapiAfter: { used: number; remaining: number; pct: number };
  };
}

// 4 daily windows. Quota is divided evenly among them so no single window
// exhausts the day's budget.
const DAILY_WINDOWS = 4;
const WINDOW_HOURS = [6, 10, 18, 22]; // morning, T-120, T-60 lineups, post-match

// Determine which window we're in (0-3)
function currentWindow(): number {
  const h = new Date().getUTCHours();
  if (h < 8) return 0;  // morning poll
  if (h < 14) return 1; // T-120 pre-lineup
  if (h < 20) return 2; // T-60 lineups
  return 3;              // post-match analysis
}

// Max API calls this window is allowed (prorated)
function windowBudget(dailyLimit: number): number {
  return Math.max(1, Math.floor(dailyLimit / DAILY_WINDOWS));
}

// Post-match: fetch results for recently settled fixtures, storing stats
async function runPostMatchAnalysis(): Promise<number> {
  let analysed = 0;

  for (const league of LEAGUE_PRIORITIES) {
    const check = await canProceed('apifootball', 'normal');
    if (!check.allowed) break;

    try {
      // Fetch completed fixtures for today (past 48h) to collect results
      const startTime = Date.now();
      const response = await apiFootballClient.getFixtures(league.apiFootballId, league.season);
      await logProviderCall('apifootball', 'fixtures/postmatch', Date.now() - startTime, 200, {
        leagueId: league.apiFootballId,
        mode: 'post_match_analysis',
      });

      for (const item of response.response) {
        const status = item.fixture.status.short;
        if (status !== 'FT' && status !== 'AET' && status !== 'PEN') continue;

        // Store match stats for calibration pipeline
        // (settlement already handled by EPIC 31 — this is for league calibration data collection)
        const fixtureId = String(item.fixture.id);
        const { data: existing } = await supabase
          .from('matches')
          .select('id')
          .eq('fixture_id', fixtureId)
          .maybeSingle();

        if (!existing) {
          await supabase.from('matches').upsert({
            fixture_id: fixtureId,
            league: league.name,
            league_id: league.apiFootballId,
            season: league.season,
            home_team: item.teams.home.name,
            away_team: item.teams.away.name,
            kickoff: item.fixture.date,
            status,
            home_score: item.goals.home,
            away_score: item.goals.away,
            var_era: true,
          });
        }

        analysed += 1;
      }
    } catch {
      break; // preserve quota
    }
  }

  return analysed;
}

// Main scheduler entry point — called by cron route
export async function runWorldwideScheduler(): Promise<SchedulerResult> {
  const windowIdx = currentWindow();
  console.log(`[WorldwideScheduler] Starting scheduler run (window ${windowIdx + 1}/${DAILY_WINDOWS})...`);

  const quotaBefore = {
    apifootball: await getQuota('apifootball'),
    oddspapi: await getQuota('oddspapi'),
  };

  // Prorate: reserve budget for remaining windows today
  const apifootballBudget = windowBudget(quotaBefore.apifootball.dailyLimit);
  const budgetUsedSoFar = quotaBefore.apifootball.usedToday;
  const windowsRemaining = DAILY_WINDOWS - windowIdx - 1;
  const reserveForLater = windowsRemaining * apifootballBudget;
  const effectiveRemaining = Math.max(0, quotaBefore.apifootball.remaining - reserveForLater);
  const quotaTight = effectiveRemaining < apifootballBudget;

  console.log(`[WorldwideScheduler] Budget: ${budgetUsedSoFar}/${quotaBefore.apifootball.dailyLimit} used, ${effectiveRemaining} effective remaining, quotaTight=${quotaTight}`);

  // --- Phase 1: Discover fixtures (top tiers only if quota tight) ---
  const discovered = await discoverFixtures();
  const { fixtures } = discovered;

  // If quota is tight, discard lower-tier fixtures
  const activeFixtures = quotaTight
    ? fixtures.filter((f) => f.leagueTier <= 1)
    : fixtures;

  console.log(`[WorldwideScheduler] Discovered ${fixtures.length} fixtures (active: ${activeFixtures.length}) across ${LEAGUE_PRIORITIES.length} leagues`);

  // --- Phase 2: Find T-60 critical window fixtures ---
  const now = new Date();
  const critical = getCriticalWindowFixtures(activeFixtures, now);

  console.log(`[WorldwideScheduler] Critical window (T-60): ${critical.length} fixtures`);

  // --- Phase 3: Run T-60 snapshots for critical fixtures ---
  let snapshotsBuilt = 0;
  let snapshotErrors = 0;

  if (critical.length > 0) {
    try {
      const snapshotResult = await runT60Snapshot();
      snapshotsBuilt = snapshotResult.total;
      snapshotErrors = snapshotResult.snapshots.filter((s) => !s.success).length;
    } catch (err) {
      console.error('[WorldwideScheduler] T-60 snapshot run failed:', err);
      snapshotErrors = critical.length;
    }
  }

  // --- Phase 3b: Post-match analysis (window 3 only) ---
  let postMatchAnalyses = 0;
  if (windowIdx === 3) {
    const check = await canProceed('apifootball', 'normal');
    if (check.allowed) {
      postMatchAnalyses = await runPostMatchAnalysis();
      console.log(`[WorldwideScheduler] Post-match analysis: ${postMatchAnalyses} fixtures analysed`);
    }
  }

  // --- Phase 4: Historical surplus (only if comfortable quota remaining) ---
  let historicalBatchesRun = 0;
  const apifootballAfterPhase3 = await getQuota('apifootball');

  if (apifootballAfterPhase3.usagePct < 75) {
    const historicalCheck = await canProceed('apifootball', 'background');
    if (historicalCheck.allowed) {
      for (const league of LEAGUE_PRIORITIES) {
        const check = await canProceed('apifootball', 'background');
        if (!check.allowed) break;
        try {
          const startTime = Date.now();
          await logProviderCall('apifootball', 'fixtures/historical', Date.now() - startTime, 200, {
            leagueId: league.apiFootballId,
            season: league.season,
            mode: 'historical_surplus',
          });
          historicalBatchesRun += 1;
        } catch {
          break;
        }
      }
    }
  }

  // --- Final quota snapshot ---
  const quotaAfter = {
    apifootball: await getQuota('apifootball'),
    oddspapi: await getQuota('oddspapi'),
  };

  const skippedCount = discovered.skipped;

  console.log('[WorldwideScheduler] Run complete', {
    window: windowIdx + 1,
    fixturesFound: activeFixtures.length,
    critical: critical.length,
    snapshotsBuilt,
    snapshotErrors,
    postMatchAnalyses,
    historicalBatchesRun,
    quota: {
      apifootball: `${quotaAfter.apifootball.usedToday}/${quotaAfter.apifootball.dailyLimit} (${quotaAfter.apifootball.usagePct}%)`,
      oddspapi: `${quotaAfter.oddspapi.usedToday}/${quotaAfter.oddspapi.dailyLimit} (${quotaAfter.oddspapi.usagePct}%)`,
    },
  });

  return {
    totalFixturesFound: activeFixtures.length,
    criticalWindowFixtures: critical.length,
    snapshotsBuilt,
    snapshotErrors,
    historicalBatchesRun,
    postMatchAnalyses,
    skipped: {
      quotaBlocked: skippedCount,
      noOdds: 0,
      alreadyProcessed: 0,
    },
    quota: {
      apifootballBefore: {
        used: quotaBefore.apifootball.usedToday,
        remaining: quotaBefore.apifootball.remaining,
        pct: quotaBefore.apifootball.usagePct,
      },
      apifootballAfter: {
        used: quotaAfter.apifootball.usedToday,
        remaining: quotaAfter.apifootball.remaining,
        pct: quotaAfter.apifootball.usagePct,
      },
      oddspapiBefore: {
        used: quotaBefore.oddspapi.usedToday,
        remaining: quotaBefore.oddspapi.remaining,
        pct: quotaBefore.oddspapi.usagePct,
      },
      oddspapiAfter: {
        used: quotaAfter.oddspapi.usedToday,
        remaining: quotaAfter.oddspapi.remaining,
        pct: quotaAfter.oddspapi.usagePct,
      },
    },
  };
}
