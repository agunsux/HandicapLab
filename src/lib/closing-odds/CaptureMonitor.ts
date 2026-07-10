/**
 * Capture Monitor — Quality Dashboard
 * =====================================
 * Provides real-time capture quality metrics:
 *  - Capture Success Rate
 *  - Missing Closing Odds
 *  - Late Capture Count
 *  - Average Capture Delay
 *  - Provider Coverage
 *  - Per-league Coverage
 *  - Per-market Coverage
 *
 * Target metrics:
 *   Closing Odds Coverage     >98%
 *   Missing Closing Odds       <2%
 *   Capture Delay              <60 seconds
 *   Duplicate Capture          0
 *   Invalid Market             0
 *   Failed Capture Retry     >99% success
 */

import { logger } from '@/lib/logger';
import { query } from '@/lib/db/connection';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CaptureHealthMetrics {
  closingOddsCoverage: number;         // %
  missingClosingOdds: number;          // raw count
  missingClosingOddsPct: number;       // %
  lateCaptureCount: number;            // captures >60s after kickoff
  averageCaptureDelay: number;         // seconds
  duplicateCount: number;              // exact duplicate captures
  invalidMarketCount: number;          // invalid/vig-outside-range
  retrySuccessRate: number;            // %
  totalMatchesTracked: number;
  totalCapturesToday: number;
}

export interface LeagueCoverageMetric {
  league: string;
  totalFixtures: number;
  withOpeningOdds: number;
  withClosingOdds: number;
  withFullMovement: number;
  openingOddsPct: number;
  closingOddsPct: number;
  movementPct: number;
  avgCaptureDelay: number;
}

export interface MarketCoverageMetric {
  marketType: string;
  totalFixtures: number;
  fixturesCovered: number;
  coveragePct: number;
  avgOddsMovement: number;
}

export interface ProviderCoverageMetric {
  provider: string;
  capturesToday: number;
  successful: number;
  failed: number;
  successRate: number;
  avgLatencyMs: number;
}

export interface TimelineStats {
  capturePhase: string;
  totalMatches: number;
  withOdds: number;
  coveragePct: number;
  avgHomeOdds: number;
  avgVig: number;
}

// ─── Monitor ────────────────────────────────────────────────────────────────

export class CaptureMonitor {
  private log = logger.child('capture-monitor');

  /**
   * Get overall capture health metrics.
   */
  async getHealthMetrics(): Promise<CaptureHealthMetrics> {
    try {
      // Total matches being tracked (upcoming + today's finished)
      const totalMatches = await query(`
        SELECT COUNT(*) as count FROM matches 
        WHERE kickoff >= NOW() - INTERVAL '7 days'
      `);
      const totalMatchesTracked = parseInt(totalMatches.rows[0]?.count || '0');

      // Closing odds coverage
      const closingOdds = await query(`
        SELECT 
          COUNT(DISTINCT co.match_id) as with_closing,
          COUNT(DISTINCT m.id) as total
        FROM matches m
        LEFT JOIN closing_odds co ON co.match_id = m.id
        WHERE m.kickoff >= NOW() - INTERVAL '7 days'
          AND m.kickoff <= NOW()
      `);
      const withClosing = parseInt(closingOdds.rows[0]?.with_closing || '0');
      const closTotal = parseInt(closingOdds.rows[0]?.total || '0');
      const closingOddsCoverage = closTotal > 0 
        ? Math.round((withClosing / closTotal) * 10000) / 100 
        : 0;
      const missingClosingOdds = closTotal - withClosing;
      const missingClosingOddsPct = closTotal > 0 
        ? Math.round((missingClosingOdds / closTotal) * 10000) / 100 
        : 0;

      // Late captures (captured after kickoff)
      const lateCaptures = await query(`
        SELECT COUNT(*) as count FROM closing_odds
        WHERE kickoff_delay_seconds > 60
          AND created_at >= NOW() - INTERVAL '7 days'
      `);
      const lateCaptureCount = parseInt(lateCaptures.rows[0]?.count || '0');

      // Average capture delay
      const avgDelay = await query(`
        SELECT COALESCE(AVG(ABS(kickoff_delay_seconds)), 0) as avg_delay
        FROM closing_odds
        WHERE created_at >= NOW() - INTERVAL '7 days'
          AND kickoff_delay_seconds IS NOT NULL
      `);
      const averageCaptureDelay = Math.round(parseFloat(avgDelay.rows[0]?.avg_delay || '0'));

      // Duplicate captures (same match/market/phase)
      const duplicates = await query(`
        SELECT COUNT(*) - COUNT(DISTINCT (match_id, market_type, capture_phase)) as dup_count
        FROM market_movements
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `);
      const duplicateCount = Math.max(0, parseInt(duplicates.rows[0]?.dup_count || '0'));

      // Invalid markets (vig > 10% or negative vig)
      const invalid = await query(`
        SELECT COUNT(*) as count FROM market_movements
        WHERE (vig > 0.10 OR vig < 0)
          AND created_at >= NOW() - INTERVAL '7 days'
      `);
      const invalidMarketCount = parseInt(invalid.rows[0]?.count || '0');

      // Retry success rate
      const retries = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE retry_attempt > 0) as retried,
          COUNT(*) FILTER (WHERE retry_attempt > 0 AND status = 'success') as retry_success
        FROM capture_log
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `);
      const retried = parseInt(retries.rows[0]?.retried || '0');
      const retrySuccess = parseInt(retries.rows[0]?.retry_success || '0');
      const retrySuccessRate = retried > 0 
        ? Math.round((retrySuccess / retried) * 10000) / 100 
        : 100;

      // Total captures today
      const todayCaptures = await query(`
        SELECT COUNT(*) as count FROM capture_log
        WHERE created_at >= CURRENT_DATE
      `);
      const totalCapturesToday = parseInt(todayCaptures.rows[0]?.count || '0');

      return {
        closingOddsCoverage,
        missingClosingOdds,
        missingClosingOddsPct,
        lateCaptureCount,
        averageCaptureDelay,
        duplicateCount,
        invalidMarketCount,
        retrySuccessRate,
        totalMatchesTracked,
        totalCapturesToday,
      };
    } catch (error: unknown) {
      this.log.error('get_health_metrics_failed', { error: error instanceof Error ? error.message : String(error) });
      return {
        closingOddsCoverage: 0,
        missingClosingOdds: 0,
        missingClosingOddsPct: 0,
        lateCaptureCount: 0,
        averageCaptureDelay: 0,
        duplicateCount: 0,
        invalidMarketCount: 0,
        retrySuccessRate: 0,
        totalMatchesTracked: 0,
        totalCapturesToday: 0,
      };
    }
  }

  /**
   * Get per-league coverage metrics.
   */
  async getLeagueCoverage(): Promise<LeagueCoverageMetric[]> {
    try {
      const result = await query(`
        SELECT 
          m.league,
          COUNT(DISTINCT m.id) as total_fixtures,
          COUNT(DISTINCT CASE WHEN mm.id IS NOT NULL AND mm.capture_phase = 'opening' THEN m.id END) as with_opening,
          COUNT(DISTINCT co.match_id) as with_closing,
          COUNT(DISTINCT CASE WHEN mm.id IS NOT NULL THEN m.id END) as with_any_movement,
          COALESCE(AVG(ABS(co.kickoff_delay_seconds)), 0) as avg_delay
        FROM matches m
        LEFT JOIN market_movements mm ON mm.match_id = m.id
        LEFT JOIN closing_odds co ON co.match_id = m.id
        WHERE m.kickoff >= NOW() - INTERVAL '30 days'
        GROUP BY m.league
        ORDER BY m.league
      `);

      return result.rows.map((row: Record<string, unknown>) => ({
        league: String(row.league),
        totalFixtures: parseInt(String(row.total_fixtures)),
        withOpeningOdds: parseInt(String(row.with_opening)),
        withClosingOdds: parseInt(String(row.with_closing)),
        withFullMovement: parseInt(String(row.with_any_movement)),
        openingOddsPct: Number(row.total_fixtures) > 0
          ? Math.round((parseInt(String(row.with_opening)) / parseInt(String(row.total_fixtures))) * 10000) / 100
          : 0,
        closingOddsPct: Number(row.total_fixtures) > 0
          ? Math.round((parseInt(String(row.with_closing)) / parseInt(String(row.total_fixtures))) * 10000) / 100
          : 0,
        movementPct: Number(row.total_fixtures) > 0
          ? Math.round((parseInt(String(row.with_any_movement)) / parseInt(String(row.total_fixtures))) * 10000) / 100
          : 0,
        avgCaptureDelay: Math.round(parseFloat(String(row.avg_delay))),
      }));
    } catch (error: unknown) {
      this.log.error('get_league_coverage_failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Get per-market coverage metrics.
   */
  async getMarketCoverage(): Promise<MarketCoverageMetric[]> {
    try {
      const result = await query(`
        SELECT 
          co.market_type,
          COUNT(DISTINCT co.match_id) as fixtures_covered,
          (SELECT COUNT(DISTINCT id) FROM matches 
           WHERE kickoff >= NOW() - INTERVAL '30 days'
             AND kickoff <= NOW()) as total_fixtures,
          COALESCE(AVG(co.odds_movement_pct), 0) as avg_movement
        FROM closing_odds co
        WHERE co.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY co.market_type
        ORDER BY co.market_type
      `);

      const totalFixtures = result.rows.length > 0
        ? parseInt(String(result.rows[0].total_fixtures))
        : 0;

      return result.rows.map((row: Record<string, unknown>) => ({
        marketType: String(row.market_type),
        totalFixtures,
        fixturesCovered: parseInt(String(row.fixtures_covered)),
        coveragePct: totalFixtures > 0
          ? Math.round((parseInt(String(row.fixtures_covered)) / totalFixtures) * 10000) / 100
          : 0,
        avgOddsMovement: Math.round(parseFloat(String(row.avg_movement)) * 10000) / 100,
      }));
    } catch (error: unknown) {
      this.log.error('get_market_coverage_failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Get provider-level capture metrics.
   */
  async getProviderCoverage(): Promise<ProviderCoverageMetric[]> {
    try {
      const result = await query(`
        SELECT 
          provider,
          COUNT(*) as captures_today,
          COUNT(*) FILTER (WHERE status = 'success') as successful,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COALESCE(AVG(duration_ms), 0) as avg_latency
        FROM capture_log
        WHERE created_at >= CURRENT_DATE
        GROUP BY provider
        ORDER BY provider
      `);

      return result.rows.map((row: Record<string, unknown>) => ({
        provider: String(row.provider),
        capturesToday: parseInt(String(row.captures_today)),
        successful: parseInt(String(row.successful)),
        failed: parseInt(String(row.failed)),
        successRate: parseInt(String(row.captures_today)) > 0
          ? Math.round((parseInt(String(row.successful)) / parseInt(String(row.captures_today))) * 10000) / 100
          : 0,
        avgLatencyMs: Math.round(parseFloat(String(row.avg_latency))),
      }));
    } catch (error: unknown) {
      this.log.error('get_provider_coverage_failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Get timeline stats by capture phase.
   */
  async getTimelineStats(): Promise<TimelineStats[]> {
    try {
      const result = await query(`
        SELECT 
          mm.capture_phase,
          COUNT(DISTINCT mm.match_id) as matches_with_odds,
          (SELECT COUNT(DISTINCT id) FROM matches 
           WHERE kickoff >= NOW() - INTERVAL '7 days') as total_matches,
          AVG(mm.home_odds) as avg_home_odds,
          AVG(mm.vig) as avg_vig
        FROM market_movements mm
        WHERE mm.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY mm.capture_phase
        ORDER BY 
          CASE mm.capture_phase
            WHEN 'opening' THEN 1
            WHEN 't-48h' THEN 2
            WHEN 't-24h' THEN 3
            WHEN 't-6h' THEN 4
            WHEN 't-3h' THEN 5
            WHEN 't-1h' THEN 6
            WHEN 't-30m' THEN 7
            WHEN 't-15m' THEN 8
            WHEN 't-5m' THEN 9
            WHEN 'kickoff' THEN 10
            WHEN 'post-kickoff' THEN 11
            ELSE 12
          END
      `);

      const totalMatches = result.rows.length > 0
        ? parseInt(String(result.rows[0].total_matches))
        : 0;

      return result.rows.map((row: Record<string, unknown>) => ({
        capturePhase: String(row.capture_phase),
        totalMatches,
        withOdds: parseInt(String(row.matches_with_odds)),
        coveragePct: totalMatches > 0
          ? Math.round((parseInt(String(row.matches_with_odds)) / totalMatches) * 10000) / 100
          : 0,
        avgHomeOdds: Math.round(parseFloat(String(row.avg_home_odds)) * 100) / 100,
        avgVig: Math.round(parseFloat(String(row.avg_vig)) * 10000) / 100,
      }));
    } catch (error: unknown) {
      this.log.error('get_timeline_stats_failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Get target vs actual comparison.
   */
  async getTargetComparison(): Promise<{
    metric: string;
    target: string;
    actual: string;
    status: '✅' | '⚠️' | '❌';
  }[]> {
    const health = await this.getHealthMetrics();

    return [
      {
        metric: 'Closing Odds Coverage',
        target: '>98%',
        actual: `${health.closingOddsCoverage}%`,
        status: health.closingOddsCoverage >= 98 ? '✅' : (health.closingOddsCoverage >= 90 ? '⚠️' : '❌'),
      },
      {
        metric: 'Missing Closing Odds',
        target: '<2%',
        actual: `${health.missingClosingOddsPct}% (${health.missingClosingOdds})`,
        status: health.missingClosingOddsPct < 2 ? '✅' : (health.missingClosingOddsPct < 5 ? '⚠️' : '❌'),
      },
      {
        metric: 'Capture Delay',
        target: '<60s',
        actual: `${health.averageCaptureDelay}s`,
        status: health.averageCaptureDelay < 60 ? '✅' : (health.averageCaptureDelay < 120 ? '⚠️' : '❌'),
      },
      {
        metric: 'Duplicate Captures',
        target: '0',
        actual: `${health.duplicateCount}`,
        status: health.duplicateCount === 0 ? '✅' : '❌',
      },
      {
        metric: 'Invalid Markets',
        target: '0',
        actual: `${health.invalidMarketCount}`,
        status: health.invalidMarketCount === 0 ? '✅' : '⚠️',
      },
      {
        metric: 'Failed Capture Retries',
        target: '>99% success',
        actual: `${health.retrySuccessRate}%`,
        status: health.retrySuccessRate >= 99 ? '✅' : (health.retrySuccessRate >= 95 ? '⚠️' : '❌'),
      },
    ];
  }

  /**
   * Get a summary table as markdown for reporting.
   */
  async generateReport(): Promise<string> {
    const health = await this.getHealthMetrics();
    const leagueCov = await this.getLeagueCoverage();
    const marketCov = await this.getMarketCoverage();
    const targets = await this.getTargetComparison();

    let report = `# Closing Odds Capture Report\n`;
    report += `**Generated**: ${new Date().toISOString()}\n\n`;

    // Target comparison
    report += `## Target vs Actual\n\n`;
    report += `| Metric | Target | Actual | Status |\n`;
    report += `|---|---|---|---|\n`;
    for (const t of targets) {
      report += `| ${t.metric} | ${t.target} | ${t.actual} | ${t.status} |\n`;
    }

    report += `\n## Overall Health\n\n`;
    report += `| Metric | Value |\n`;
    report += `|---|---|\n`;
    report += `| Total Matches Tracked (7d) | ${health.totalMatchesTracked} |\n`;
    report += `| Total Captures Today | ${health.totalCapturesToday} |\n`;
    report += `| Closing Odds Coverage | ${health.closingOddsCoverage}% |\n`;
    report += `| Missing Closing Odds | ${health.missingClosingOdds} (${health.missingClosingOddsPct}%) |\n`;
    report += `| Late Captures (>60s) | ${health.lateCaptureCount} |\n`;
    report += `| Avg Capture Delay | ${health.averageCaptureDelay}s |\n`;
    report += `| Duplicates | ${health.duplicateCount} |\n`;
    report += `| Invalid Markets | ${health.invalidMarketCount} |\n`;
    report += `| Retry Success Rate | ${health.retrySuccessRate}% |\n`;

    // Per-league
    report += `\n## Per-League Coverage\n\n`;
    report += `| League | Total | Opening | Closing | Movement | Delay |\n`;
    report += `|---|---:|---:|---:|---:|---:|\n`;
    for (const l of leagueCov) {
      report += `| ${l.league} | ${l.totalFixtures} | ${l.openingOddsPct}% | ${l.closingOddsPct}% | ${l.movementPct}% | ${l.avgCaptureDelay}s |\n`;
    }

    // Per-market
    report += `\n## Per-Market Coverage\n\n`;
    report += `| Market | Total | Covered | Coverage | Avg Movement |\n`;
    report += `|---|---:|---:|---:|---:|\n`;
    for (const m of marketCov) {
      report += `| ${m.marketType} | ${m.totalFixtures} | ${m.fixturesCovered} | ${m.coveragePct}% | ${m.avgOddsMovement}% |\n`;
    }

    return report;
  }
}