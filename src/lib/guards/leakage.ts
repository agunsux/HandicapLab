import { supabase } from '../supabase.server';

export class LeakageError extends Error {
  constructor(
    public matchId: string,
    public violationType: 'MATCH_EVENT_LEAK' | 'FEATURE_GENERATION_LEAK' | 'ODDS_SNAPSHOT_LEAK',
    message: string
  ) {
    super(`[Leakage Violation] Match ${matchId} - ${violationType}: ${message}`);
    this.name = 'LeakageError';
  }
}

/**
 * LeakageGuard provides runtime security checks to enforce future-data isolation.
 * Crucial for preventing look-ahead bias in backtests and production predictions.
 */
export class LeakageGuard {
  /**
   * Asserts that no future data relative to the cutoff date is injected, queried, or processed.
   * Checks match status, goal events, generated prediction timestamps, and odds snapshot timestamps.
   * 
   * @param matchId Target match identifier
   * @param cutoff The simulation or prediction cutoff date threshold
   * @throws {LeakageError} if a look-ahead leakage violation is discovered
   * 
   * @example
   * ```typescript
   * // Inside a Feature Extractor or Predictor:
   * const kickoffAt = new Date(match.kickoff);
   * 
   * // Hard-gate before extracting features or generating probability outputs
   * await LeakageGuard.assertNoFutureData(matchId, kickoffAt);
   * 
   * // Proceed to aggregate historic metrics...
   * const form = await FormExtractor.extract(homeTeam, awayTeam, kickoffAt);
   * ```
   */
  static async assertNoFutureData(matchId: string, cutoff: Date): Promise<void> {
    if (process.env.SKIP_LEAKAGE_GUARD === 'true') {
      return;
    }

    const cutoffTime = cutoff.getTime();

    // 1. Check match status and goals relative to cutoff
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('id, status, kickoff, home_goals, away_goals')
      .eq('id', matchId)
      .maybeSingle();

    if (matchErr) {
      console.warn(`[LeakageGuard] Error checking match metadata for ${matchId}:`, matchErr.message);
    } else if (match) {
      const kickoffTime = new Date(match.kickoff).getTime();
      
      // If cutoff is before or at kickoff, we must NOT have final goals or finished status
      if (cutoffTime <= kickoffTime) {
        if (match.status === 'finished' || match.home_goals !== null || match.away_goals !== null) {
          throw new LeakageError(
            matchId,
            'MATCH_EVENT_LEAK',
            `Match is marked finished or contains goals, but cutoff is pre-kickoff.`
          );
        }
      }
    }

    // 2. Check odds snapshots and features in predictions table
    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select('id, generated_at, odds_snapshot')
      .eq('match_id', matchId);

    if (predErr) {
      console.warn(`[LeakageGuard] Error checking predictions for ${matchId}:`, predErr.message);
      return;
    }

    if (predictions && predictions.length > 0) {
      for (const pred of predictions) {
        // Check feature generation time
        if (pred.generated_at) {
          const genTime = new Date(pred.generated_at).getTime();
          if (genTime > cutoffTime) {
            throw new LeakageError(
              matchId,
              'FEATURE_GENERATION_LEAK',
              `Feature was generated at ${pred.generated_at}, which is after cutoff ${cutoff.toISOString()}.`
            );
          }
        }

        // Check odds snapshot timestamp
        const snapshot = pred.odds_snapshot;
        if (snapshot && typeof snapshot === 'object') {
          const oddsTs = (snapshot as any).timestamp;
          if (oddsTs && oddsTs > cutoffTime) {
            throw new LeakageError(
              matchId,
              'ODDS_SNAPSHOT_LEAK',
              `Odds snapshot timestamp ${new Date(oddsTs).toISOString()} is after cutoff ${cutoff.toISOString()}.`
            );
          }
        }
      }
    }
  }
}
