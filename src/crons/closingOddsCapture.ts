/**
 * Closing Odds Capture Cron
 * ===========================
 * Scheduled job that runs periodically to capture odds at the right phases.
 *
 * Schedule recommendation:
 *   - Every 5 minutes during active match windows
 *   - Every 15 minutes during off-hours
 *
 * Run modes:
 *   capture:  Capture odds for all upcoming matches (default)
 *   backfill: Pull latest odds for matches nearing kickoff
 *   monitor:  Generate capture health report
 *   clv:      Recompute CLV for finished matches without CLV
 */

import { logger } from '@/lib/logger';
import { query } from '@/lib/db/connection';
import { CaptureEngine, CAPTURE_SCHEDULE } from '@/lib/closing-odds/CaptureEngine';
import { CaptureMonitor } from '@/lib/closing-odds/CaptureMonitor';
import type { MatchToCapture, CapturePhase, CaptureRunResult } from '@/lib/closing-odds/CaptureEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CronConfig {
  mode: 'capture' | 'backfill' | 'monitor' | 'clv';
  leagues?: string[];
  maxLeagues?: number;
  lookaheadHours?: number;
}

interface CronResult {
  mode: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  captures?: CaptureRunResult[];
  matchesProcessed?: number;
  error?: string;
}

// ─── Logger ─────────────────────────────────────────────────────────────────

const log = logger.child('cron:closing-odds');

// ─── Module Exports ─────────────────────────────────────────────────────────

/**
 * Default: capture odds for all upcoming matches.
 */
export async function captureUpcomingMatches(
  config: CronConfig = { mode: 'capture' }
): Promise<CronResult> {
  const startedAt = new Date();
  const engine = new CaptureEngine();
  const results: CaptureRunResult[] = [];

  try {
    // Fetch upcoming matches from DB
    const matches = await fetchUpcomingMatches(config);
    log.info('fetched_upcoming_matches', { count: matches.length });

    if (matches.length === 0) {
      return {
        mode: config.mode,
        startedAt,
        completedAt: new Date(),
        durationMs: 0,
        matchesProcessed: 0,
      };
    }

    // Determine which phases to run based on current time
    const phasesToRun = getPhasesToRun();

    for (const phase of phasesToRun) {
      const result = await engine.runCapturePhase(phase, matches);
      results.push(result);
      log.info('capture_phase_complete', {
        phase,
        total: result.totalMatches,
        successful: result.successfulCaptures,
        failed: result.failedCaptures,
        coverage: result.coveragePct,
        durationMs: result.durationMs,
      });
    }

    const completedAt = new Date();
    return {
      mode: config.mode,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      captures: results,
      matchesProcessed: matches.length,
    };
  } catch (error: any) {
    log.error('capture_cron_failed', { error: error.message });
    return {
      mode: config.mode,
      startedAt,
      completedAt: new Date(),
      durationMs: new Date().getTime() - startedAt.getTime(),
      error: error.message,
    };
  }
}

/**
 * Backfill: fetch latest odds for matches nearing kickoff (T-6h or less).
 */
export async function backfillClosingOdds(
  config: CronConfig = { mode: 'backfill', lookaheadHours: 6 }
): Promise<CronResult> {
  const startedAt = new Date();
  const engine = new CaptureEngine();

  try {
    // Fetch matches within the backfill window
    const matches = await fetchNearKickoffMatches(config.lookaheadHours || 6);
    log.info('backfill_matches_found', { count: matches.length });

    if (matches.length === 0) {
      return {
        mode: 'backfill',
        startedAt,
        completedAt: new Date(),
        durationMs: 0,
        matchesProcessed: 0,
      };
    }

    // Capture at the nearest applicable phase
    const results: CaptureRunResult[] = [];
    for (const match of matches) {
      const phase = engine.determinePhase(match);
      if (phase && phase !== 'post-kickoff') {
        const result = await engine.runCapturePhase(phase, [match]);
        results.push(result);
      }
    }

    const completedAt = new Date();
    return {
      mode: 'backfill',
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      captures: results,
      matchesProcessed: matches.length,
    };
  } catch (error: any) {
    log.error('backfill_cron_failed', { error: error.message });
    return {
      mode: 'backfill',
      startedAt,
      completedAt: new Date(),
      durationMs: new Date().getTime() - startedAt.getTime(),
      error: error.message,
    };
  }
}

/**
 * Monitor: generate capture health report.
 */
export async function generateCaptureReport(): Promise<string> {
  const monitor = new CaptureMonitor();
  return await monitor.generateReport();
}

/**
 * CLV Recompute: compute CLV for any finished matches missing CLV data.
 */
export async function recomputeCLV(): Promise<CronResult> {
  const startedAt = new Date();
  const engine = new CaptureEngine();

  try {
    // Find finished matches that don't have CLV results
    const matches = await query(`
      SELECT DISTINCT m.id, m.home_team, m.away_team, m.league, m.kickoff
      FROM matches m
      JOIN predictions p ON p.match_id = m.id
      LEFT JOIN clv_results cr ON cr.match_id = m.id
      WHERE m.status = 'finished'
        AND m.kickoff >= NOW() - INTERVAL '30 days'
        AND cr.id IS NULL
      LIMIT 50
    `);

    const matchList: MatchToCapture[] = matches.rows.map((r: any) => ({
      id: r.id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      league: r.league,
      kickoff: new Date(r.kickoff),
    }));

    log.info('clv_recompute_matches', { count: matchList.length });

    // We can't re-fetch historical closing odds, but we can compute CLV
    // from existing closing_odds data
    for (const match of matchList) {
      await engine['computeCLVForMatches']([match]);
    }

    const completedAt = new Date();
    return {
      mode: 'clv',
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      matchesProcessed: matchList.length,
    };
  } catch (error: any) {
    log.error('clv_recompute_failed', { error: error.message });
    return {
      mode: 'clv',
      startedAt,
      completedAt: new Date(),
      durationMs: new Date().getTime() - startedAt.getTime(),
      error: error.message,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchUpcomingMatches(config: CronConfig): Promise<MatchToCapture[]> {
  const lookaheadHours = config.lookaheadHours || 72; // Default: 72 hours lookahead
  const leagueFilter = config.leagues?.length
    ? `AND m.league = ANY($1)`
    : '';
  const params = leagueFilter
    ? [config.leagues, lookaheadHours]
    : [lookaheadHours];

  const result = await query(
    `SELECT m.id, m.home_team, m.away_team, m.league, m.kickoff
     FROM matches m
     WHERE m.status = 'upcoming'
       AND m.kickoff >= NOW()
       AND m.kickoff <= NOW() + INTERVAL '1 hour' * $${params.length}
     ORDER BY m.kickoff ASC
     ${config.maxLeagues ? `LIMIT ${config.maxLeagues * 50}` : 'LIMIT 200'}`,
    params
  );

  return result.rows.map((r: any) => ({
    id: r.id,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    league: r.league,
    kickoff: new Date(r.kickoff),
  }));
}

async function fetchNearKickoffMatches(lookaheadHours: number): Promise<MatchToCapture[]> {
  const result = await query(
    `SELECT m.id, m.home_team, m.away_team, m.league, m.kickoff
     FROM matches m
     WHERE m.status = 'upcoming'
       AND m.kickoff >= NOW()
       AND m.kickoff <= NOW() + INTERVAL '1 hour' * $1
     ORDER BY m.kickoff ASC
     LIMIT 100`,
    [lookaheadHours]
  );

  return result.rows.map((r: any) => ({
    id: r.id,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    league: r.league,
    kickoff: new Date(r.kickoff),
  }));
}

/**
 * Determine which capture phases to run based on current time.
 */
function getPhasesToRun(): CapturePhase[] {
  const now = new Date();
  const hour = now.getUTCHours();

  // During active match hours (8:00 - 23:00 UTC), run all applicable phases
  if (hour >= 8 && hour <= 23) {
    return [
      'opening', 't-48h', 't-24h', 't-6h', 't-3h',
      't-1h', 't-30m', 't-15m', 't-5m', 'kickoff',
    ];
  }

  // Off-hours: only run long-range phases
  return ['opening', 't-48h', 't-24h', 't-6h'];
}

// ─── Direct Execution ───────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2] || 'capture';

  switch (mode) {
    case 'capture':
      log.info('running_capture_mode');
      const result = await captureUpcomingMatches();
      log.info('capture_complete', result);
      break;

    case 'backfill':
      log.info('running_backfill_mode');
      const backfillResult = await backfillClosingOdds();
      log.info('backfill_complete', backfillResult);
      break;

    case 'monitor':
      log.info('running_monitor_mode');
      const report = await generateCaptureReport();
      console.log(report);
      break;

    case 'clv':
      log.info('running_clv_recompute');
      const clvResult = await recomputeCLV();
      log.info('clv_recompute_complete', clvResult);
      break;

    default:
      console.error(`Unknown mode: ${mode}. Use: capture | backfill | monitor | clv`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}