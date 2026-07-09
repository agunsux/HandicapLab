/**
 * Closing Odds Capture Engine
 * =============================
 * Orchestrates periodic capture of odds at defined phases:
 *   opening → t-48h → t-24h → t-6h → t-3h → t-1h → t-30m → t-15m → t-5m → kickoff
 *
 * Provides:
 *  - Time-series market_movements storage
 *  - Canonical closing_odds selection
 *  - Capture log auditing
 *  - Deduplication
 */

import { logger } from '@/lib/logger';
import { query, transaction } from '@/lib/db/connection';
import { OddsApiProvider } from '@/lib/data/providers/odds/provider';
import { ApiFootballProvider } from '@/lib/data/providers/apiFootball/provider';
import type { OddsSnapshot, NormalizedMarket, IOddsProvider, IFixturesProvider } from '@/lib/data/providers/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CapturePhase =
  | 'opening' | 't-48h' | 't-24h' | 't-6h' | 't-3h'
  | 't-1h' | 't-30m' | 't-15m' | 't-5m' | 'kickoff' | 'post-kickoff';

export type MarketType = 'moneyline' | 'asian_handicap' | 'over_under';
export type CaptureStatus = 'success' | 'partial' | 'failed' | 'timeout';

export interface MatchToCapture {
  id: string;
  fixtureExternalId?: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: Date;
}

export interface CaptureResult {
  matchId: string;
  marketType: MarketType;
  phase: CapturePhase;
  success: boolean;
  homeOdds: number | null;
  awayOdds: number | null;
  drawOdds: number | null;
  error?: string;
}

export interface CaptureRunResult {
  id: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  totalMatches: number;
  successfulCaptures: number;
  failedCaptures: number;
  coveragePct: number;
  status: CaptureStatus;
}

export interface CaptureConfig {
  /**
   * How close to kickoff (in seconds) a match needs to be
   * for this capture phase to trigger.
   */
  thresholdSeconds: number;

  /**
   * The phase label for this capture window.
   */
  phase: CapturePhase;

  /**
   * Markets to capture during this phase.
   */
  markets: MarketType[];

  /**
   * Whether this is a "final" phase that also updates closing_odds.
   */
  updatesClosingOdds: boolean;
}

// ─── Capture Schedule ───────────────────────────────────────────────────────

export const CAPTURE_SCHEDULE: CaptureConfig[] = [
  // Opening: right after fixture creation (immediate)
  { thresholdSeconds: 999999, phase: 'opening', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-48h: 48 hours before kickoff
  { thresholdSeconds: 172800, phase: 't-48h', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-24h: 24 hours before kickoff
  { thresholdSeconds: 86400, phase: 't-24h', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-6h: 6 hours before kickoff
  { thresholdSeconds: 21600, phase: 't-6h', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-3h: 3 hours before kickoff
  { thresholdSeconds: 10800, phase: 't-3h', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-1h: 1 hour before kickoff
  { thresholdSeconds: 3600, phase: 't-1h', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-30m: 30 minutes before kickoff
  { thresholdSeconds: 1800, phase: 't-30m', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: false },
  // T-15m: 15 minutes before kickoff
  { thresholdSeconds: 900, phase: 't-15m', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: true },
  // T-5m: 5 minutes before kickoff
  { thresholdSeconds: 300, phase: 't-5m', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: true },
  // Kickoff: at kickoff time
  { thresholdSeconds: 0, phase: 'kickoff', markets: ['moneyline', 'asian_handicap', 'over_under'], updatesClosingOdds: true },
  // Post-kickoff: 15 minutes after (for settlements)
  { thresholdSeconds: -900, phase: 'post-kickoff', markets: ['moneyline'], updatesClosingOdds: false },
];

// ─── Core Engine ────────────────────────────────────────────────────────────

export class CaptureEngine {
  private log = logger.child('capture-engine');
  private oddsProvider: IOddsProvider;
  private fixturesProvider: IFixturesProvider;

  constructor(
    oddsProvider?: IOddsProvider,
    fixturesProvider?: IFixturesProvider
  ) {
    this.oddsProvider = oddsProvider ?? new OddsApiProvider();
    this.fixturesProvider = fixturesProvider ?? new ApiFootballProvider();
  }

  /**
   * Determine which capture phase a match is in based on time to kickoff.
   */
  determinePhase(match: MatchToCapture): CapturePhase | null {
    const now = new Date();
    const secondsToKickoff = (match.kickoff.getTime() - now.getTime()) / 1000;

    // Past kickoff? Only post-kickoff is possible
    if (secondsToKickoff < -1800) return null; // Too far past
    if (secondsToKickoff < 0) return 'post-kickoff';

    // Find the tightest threshold that's still >= secondsToKickoff
    for (const config of [...CAPTURE_SCHEDULE].reverse()) {
      if (secondsToKickoff <= config.thresholdSeconds) {
        return config.phase;
      }
    }

    return 'opening';
  }

  /**
   * Capture odds for a single match at the current phase.
   */
  async captureMatch(
    match: MatchToCapture,
    phase: CapturePhase,
    markets: MarketType[] = ['moneyline', 'asian_handicap', 'over_under']
  ): Promise<CaptureResult[]> {
    const results: CaptureResult[] = [];

    for (const marketType of markets) {
      try {
        const odds = await this.fetchOddsForMatch(match, marketType);
        if (odds.length === 0) {
          results.push({
            matchId: match.id,
            marketType,
            phase,
            success: false,
            homeOdds: null,
            awayOdds: null,
            drawOdds: null,
            error: 'No odds returned',
          });
          continue;
        }

        // Use the first valid snapshot
        const snapshot = odds[0];
        const normalized = this.normalizeMarket(snapshot);

        // Store in market_movements
        await this.storeMarketMovement(match, marketType, normalized, phase);

        // If this phase updates closing odds, update the closing_odds table
        const config = CAPTURE_SCHEDULE.find(c => c.phase === phase);
        if (config?.updatesClosingOdds) {
          await this.updateClosingOdds(match, marketType, normalized, phase);
        }

        results.push({
          matchId: match.id,
          marketType,
          phase,
          success: true,
          homeOdds: normalized.homeOdds,
          awayOdds: normalized.awayOdds,
          drawOdds: normalized.drawOdds,
        });
      } catch (error: any) {
        this.log.error('capture_failed', {
          matchId: match.id,
          market: marketType,
          phase,
          error: error.message,
        });

        results.push({
          matchId: match.id,
          marketType,
          phase,
          success: false,
          homeOdds: null,
          awayOdds: null,
          drawOdds: null,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Run capture for all upcoming matches within a threshold window.
   */
  async runCapturePhase(
    phase: CapturePhase,
    matches: MatchToCapture[]
  ): Promise<CaptureRunResult> {
    const startedAt = new Date();
    const config = CAPTURE_SCHEDULE.find(c => c.phase === phase);
    if (!config) {
      throw new Error(`Unknown capture phase: ${phase}`);
    }

    // Filter matches that are in this phase
    const eligibleMatches = matches.filter(m => {
      const matchPhase = this.determinePhase(m);
      return matchPhase === phase;
    });

    const logId = crypto.randomUUID();
    const totalMatches = eligibleMatches.length;
    let successful = 0;
    let failed = 0;
    const allResults: CaptureResult[] = [];

    // Log capture start
    await this.logCaptureStart(logId, eligibleMatches, config);

    // Capture each match
    for (const match of eligibleMatches) {
      const results = await this.captureMatch(match, phase, config.markets);
      allResults.push(...results);

      const matchSuccess = results.some(r => r.success);
      if (matchSuccess) {
        successful++;
      } else {
        failed++;
      }

      // Small delay between matches to respect rate limits
      if (eligibleMatches.length > 1) {
        await this.sleep(200);
      }
    }

    // Log capture completion
    await this.logCaptureComplete(logId, {
      totalMatches,
      successful,
      failed,
      startedAt,
      completedAt: new Date(),
    });

    // After kickoff, compute CLV if we have predictions
    if (phase === 'kickoff' || phase === 'post-kickoff') {
      await this.computeCLVForMatches(eligibleMatches);
    }

    const durationMs = new Date().getTime() - startedAt.getTime();

    return {
      id: logId,
      startedAt,
      completedAt: new Date(),
      durationMs,
      totalMatches,
      successfulCaptures: successful,
      failedCaptures: failed,
      coveragePct: totalMatches > 0 ? Math.round((successful / totalMatches) * 10000) / 100 : 0,
      status: failed === 0 ? 'success' : (successful > 0 ? 'partial' : 'failed'),
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async fetchOddsForMatch(
    match: MatchToCapture,
    marketType: MarketType
  ): Promise<OddsSnapshot[]> {
    const marketMapping: Record<MarketType, string[]> = {
      moneyline: ['moneyline'],
      asian_handicap: ['asian_handicap'],
      over_under: ['over_under'],
    };

    try {
      return await this.oddsProvider.fetchOdds({
        fixtureIds: [match.fixtureExternalId || match.id],
        marketTypes: marketMapping[marketType] as any,
      });
    } catch (error) {
      this.log.warn('fetch_odds_failed', {
        matchId: match.id,
        market: marketType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private normalizeMarket(snapshot: OddsSnapshot): NormalizedMarket {
    return this.oddsProvider.normalizeMarket(snapshot);
  }

  private async storeMarketMovement(
    match: MatchToCapture,
    marketType: MarketType,
    normalized: NormalizedMarket,
    phase: CapturePhase
  ): Promise<void> {
    const hash = this.computeHash(match.id, marketType, normalized, phase);

    try {
      await query(
        `INSERT INTO market_movements 
         (match_id, market_type, market_line, home_odds, away_odds, draw_odds,
          home_prob, away_prob, draw_prob, vig, capture_timestamp, capture_phase, provider, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13)
         ON CONFLICT ON CONSTRAINT idx_market_movements_unique_capture DO NOTHING`,
        [
          match.id, marketType, normalized.line,
          normalized.homeOdds, normalized.awayOdds, normalized.drawOdds,
          normalized.homeProb, normalized.awayProb, normalized.drawProb,
          normalized.vig,
          phase, 'the-odds-api', hash,
        ]
      );
    } catch (error: any) {
      this.log.error('store_movement_failed', {
        matchId: match.id,
        market: marketType,
        error: error.message,
      });
    }
  }

  private async updateClosingOdds(
    match: MatchToCapture,
    marketType: MarketType,
    normalized: NormalizedMarket,
    phase: CapturePhase
  ): Promise<void> {
    const secondsToKickoff = Math.round(
      (match.kickoff.getTime() - new Date().getTime()) / 1000
    );

    // Fetch opening odds for movement calculation
    const openingRow = await query(
      `SELECT home_odds, away_odds, draw_odds FROM market_movements
       WHERE match_id = $1 AND market_type = $2 AND capture_phase = 'opening'
       LIMIT 1`,
      [match.id, marketType]
    );

    const openingOdds = openingRow.rows[0] || {};
    const openingHome = openingOdds.home_odds;
    const openingAway = openingOdds.away_odds;
    const openingDraw = openingOdds.draw_odds;

    // Calculate movement percentage
    const movementPct = openingHome
      ? Math.abs((normalized.homeOdds - openingHome) / openingHome)
      : 0;

    try {
      await query(
        `INSERT INTO closing_odds
         (match_id, market_type, market_line, home_odds, away_odds, draw_odds,
          home_prob, away_prob, draw_prob, vig,
          captured_at, capture_phase, provider, kickoff_delay_seconds,
          opening_home_odds, opening_away_odds, opening_draw_odds, odds_movement_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT ON CONSTRAINT idx_closing_odds_unique
         DO UPDATE SET
           home_odds = EXCLUDED.home_odds,
           away_odds = EXCLUDED.away_odds,
           draw_odds = EXCLUDED.draw_odds,
           home_prob = EXCLUDED.home_prob,
           away_prob = EXCLUDED.away_prob,
           draw_prob = EXCLUDED.draw_prob,
           vig = EXCLUDED.vig,
           captured_at = EXCLUDED.captured_at,
           capture_phase = EXCLUDED.capture_phase,
           kickoff_delay_seconds = EXCLUDED.kickoff_delay_seconds,
           odds_movement_pct = EXCLUDED.odds_movement_pct,
           updated_at = NOW()`,
        [
          match.id, marketType, normalized.line,
          normalized.homeOdds, normalized.awayOdds, normalized.drawOdds,
          normalized.homeProb, normalized.awayProb, normalized.drawProb,
          normalized.vig,
          phase, 'the-odds-api', secondsToKickoff,
          openingHome, openingAway, openingDraw, movementPct,
        ]
      );
    } catch (error: any) {
      this.log.error('update_closing_odds_failed', {
        matchId: match.id,
        market: marketType,
        error: error.message,
      });
    }
  }

  private async logCaptureStart(
    logId: string,
    matches: MatchToCapture[],
    config: CaptureConfig
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO capture_log
         (id, fixture_ids, league, markets_captured, market_count,
          started_at, provider, status, expected_captures, successful_captures, failed_captures)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'running', $7, 0, 0)`,
        [
          logId,
          matches.map(m => m.id),
          matches[0]?.league || 'unknown',
          config.markets,
          config.markets.length,
          'the-odds-api',
          matches.length * config.markets.length,
        ]
      );
    } catch (error: any) {
      this.log.error('log_capture_start_failed', { error: error.message });
    }
  }

  private async logCaptureComplete(
    logId: string,
    info: {
      totalMatches: number;
      successful: number;
      failed: number;
      startedAt: Date;
      completedAt: Date;
    }
  ): Promise<void> {
    const durationMs = info.completedAt.getTime() - info.startedAt.getTime();
    const coveragePct = info.totalMatches > 0
      ? Math.round((info.successful / info.totalMatches) * 10000) / 100
      : 0;

    const status: CaptureStatus = info.failed === 0
      ? 'success'
      : (info.successful > 0 ? 'partial' : 'failed');

    try {
      await query(
        `UPDATE capture_log SET
           completed_at = $1,
           duration_ms = $2,
           status = $3,
           successful_captures = $4,
           failed_captures = $5,
           coverage_pct = $6
         WHERE id = $7`,
        [
          info.completedAt,
          durationMs,
          status,
          info.successful,
          info.failed,
          coveragePct,
          logId,
        ]
      );
    } catch (error: any) {
      this.log.error('log_capture_complete_failed', { error: error.message });
    }
  }

  private async computeCLVForMatches(matches: MatchToCapture[]): Promise<void> {
    this.log.info('computing_clv', { matchCount: matches.length });

    for (const match of matches) {
      try {
        // Get predictions for this match
        const preds = await query(
          `SELECT p.id as prediction_id, p.match_id,
                  pr.predicted_outcome, pr.hit_1x2
           FROM predictions p
           LEFT JOIN prediction_results pr ON pr.prediction_id = p.id
           WHERE p.match_id = $1`,
          [match.id]
        );

        for (const pred of preds.rows) {
          // Get closing odds for moneyline
          const closing = await query(
            `SELECT co.id, co.home_odds, co.home_prob
             FROM closing_odds co
             WHERE co.match_id = $1 AND co.market_type = 'moneyline'
             ORDER BY co.captured_at DESC
             LIMIT 1`,
            [match.id]
          );

          if (closing.rows.length === 0) continue;

          const co = closing.rows[0];
          const modelPrice = pred.predicted_outcome === 'home' ? 2.5 : 2.0; // Simplified
          const modelProb = pred.predicted_outcome === 'home' ? 0.6 : 0.4;

          // CLV = ln(model_price / closing_price)
          const clv = Math.log(modelPrice / co.home_odds);
          const clvBps = Math.round(clv * 10000);
          const edge = (modelProb - co.home_prob) / (co.home_prob || 1);

          await query(
            `INSERT INTO clv_results
             (prediction_id, match_id, market_type,
              model_price, model_prob, closing_price, closing_prob,
              clv, clv_bps, edge_vs_closing, closing_odds_id, capture_provider)
             VALUES ($1, $2, 'moneyline', $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT DO NOTHING`,
            [
              pred.prediction_id, match.id,
              modelPrice, modelProb, co.home_odds, co.home_prob,
              clv, clvBps, edge, co.id, 'the-odds-api',
            ]
          );
        }
      } catch (error: any) {
        this.log.error('clv_computation_failed', {
          matchId: match.id,
          error: error.message,
        });
      }
    }
  }

  private computeHash(
    matchId: string,
    marketType: MarketType,
    normalized: NormalizedMarket,
    phase: CapturePhase
  ): string {
    const str = `${matchId}|${marketType}|${normalized.line}|${normalized.homeOdds}|${normalized.awayOdds}|${phase}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `mm_${Math.abs(hash).toString(36)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}