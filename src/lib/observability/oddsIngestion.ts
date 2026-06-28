import { supabase } from '@/lib/supabase.server';
import { randomUUID } from 'crypto';

/**
 * Typed rejection reason codes for odds enrichment skips.
 * These are the only valid values stored in rejection_log.
 */
export type OddsRejectionReason =
  | 'malformed_price'    // price is NaN, Infinity, <= 1.0, or non-numeric
  | 'missing_market'     // bookmaker found but target market key absent (h2h / spreads / totals)
  | 'invalid_bookmaker'  // pinnacle not present in bookmakers array for this event
  | 'missing_line';      // market found but no outcome with expected handicap/total line

export interface OddsRejection {
  signalId?: string;
  fixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  reason: OddsRejectionReason;
  detail?: string;
}

/**
 * Accumulates observability counters for a single cron run of the odds pipeline.
 * Create one instance at the top of the cron handler and call flush() before returning.
 *
 * flush() is idempotent — the first call persists, subsequent calls are silent no-ops.
 */
export class OddsIngestionContext {
  readonly cronName: string;

  /** Stable execution ID generated at construction time for log correlation. */
  readonly executionId: string;

  fixturesReceived = 0;
  oddsEnriched = 0;
  oddsRejected = 0;
  signalsGenerated = 0;
  fixturesWithoutOdds = 0;

  /** DB-generated row id, populated after first successful flush. */
  private _persistedId: string | null = null;

  /** Whether flush() has already been called (regardless of DB success). */
  private _flushed = false;

  private readonly rejections: OddsRejection[] = [];

  constructor(cronName: string) {
    this.cronName = cronName;
    this.executionId = randomUUID();
  }

  /** True after flush() has been called at least once. */
  get flushed(): boolean {
    return this._flushed;
  }

  /** DB row id (null until first successful flush). */
  get persistedId(): string | null {
    return this._persistedId;
  }

  /** Alias for persistedId for external usage */
  get runId(): string | null {
    return this._persistedId;
  }

  /**
   * Record a single market rejection. Increments oddsRejected automatically.
   */
  reject(rejection: OddsRejection): void {
    this.oddsRejected++;
    this.rejections.push(rejection);
  }

  /**
   * Flush one row to odds_ingestion_runs.
   *
   * - Idempotent: second+ calls are silent no-ops.
   * - Non-fatal: errors are logged but never thrown, so a flush failure
   *   cannot mask the original pipeline error.
   */
  async flush(): Promise<void> {
    // If we already have a persisted row, update it.
    if (this._persistedId) {
      try {
        const { error } = await supabase
          .from('odds_ingestion_runs')
          .update({
            fixtures_received: this.fixturesReceived,
            odds_enriched: this.oddsEnriched,
            odds_rejected: this.oddsRejected,
            signals_generated: this.signalsGenerated,
            fixtures_without_odds: this.fixturesWithoutOdds,
            rejection_log: this.rejections,
          })
          .eq('id', this._persistedId);
        if (error) {
          console.error(`[OddsIngestionContext] update failed for execution ${this.executionId} (cron: "${this.cronName}"):`, error);
        } else {
          console.log(`[OddsIngestionContext] updated run ${this._persistedId} with latest counters.`);
        }
      } catch (err) {
        console.error(`[OddsIngestionContext] update exception for execution ${this.executionId} (cron: "${this.cronName}"):`, err);
      }
      return;
    }

    // First flush – INSERT a new row.
    if (this._flushed) {
      console.warn(`[OddsIngestionContext] flush() already called for execution ${this.executionId} (cron: ${this.cronName}). Skipping duplicate insert.`);
      return;
    }
    this._flushed = true;

    try {
      const { data, error } = await supabase.from('odds_ingestion_runs').insert({
        cron_name: this.cronName,
        execution_id: this.executionId,
        fixtures_received: this.fixturesReceived,
        odds_enriched: this.oddsEnriched,
        odds_rejected: this.oddsRejected,
        signals_generated: this.signalsGenerated,
        fixtures_without_odds: this.fixturesWithoutOdds,
        rejection_log: this.rejections,
      }).select('id').maybeSingle();

      if (error) {
        console.error(`[OddsIngestionContext] flush (insert) failed for execution ${this.executionId} (cron: "${this.cronName}"):`, error);
      } else {
        this._persistedId = data?.id ?? null;
        console.log(`[OddsIngestionContext] flushed — execution: ${this.executionId} | cron: ${this.cronName} | received: ${this.fixturesReceived} | enriched: ${this.oddsEnriched} | rejected: ${this.oddsRejected} | signals: ${this.signalsGenerated} | no-odds fixtures: ${this.fixturesWithoutOdds}`);
      }
    } catch (err) {
      console.error(`[OddsIngestionContext] flush (insert) exception for execution ${this.executionId} (cron: "${this.cronName}"):`, err);
    }
  }

  /**
   * Returns a plain summary object safe for inclusion in API response payloads.
   */
  summary() {
    return {
      executionId: this.executionId,
      fixturesReceived: this.fixturesReceived,
      oddsEnriched: this.oddsEnriched,
      oddsRejected: this.oddsRejected,
      signalsGenerated: this.signalsGenerated,
      fixturesWithoutOdds: this.fixturesWithoutOdds,
      rejectionBreakdown: this.rejectionBreakdown(),
    };
  }

  /** Counts rejections by reason code. */
  private rejectionBreakdown(): Record<OddsRejectionReason, number> {
    const breakdown: Record<OddsRejectionReason, number> = {
      malformed_price: 0,
      missing_market: 0,
      invalid_bookmaker: 0,
      missing_line: 0,
    };
    for (const r of this.rejections) {
      breakdown[r.reason]++;
    }
    return breakdown;
  }
}

