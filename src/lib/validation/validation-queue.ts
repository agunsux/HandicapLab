import { supabase } from '../supabase.server';
import { getLeagueConfig } from '../crons/leagueRegistry';

export interface QueueEligibilityInput {
  fixtureId: string;
  leagueId: string | number;
  scheduledTime: string | Date;
  marketAvailable: boolean;
  referenceBookAvailable: boolean;
  liquidityScore: number;
}

export class ValidationQueueManager {
  /**
   * Checks if a fixture meets the strict ingestion criteria for validation.
   */
  public static checkEligibility(input: QueueEligibilityInput): { eligible: boolean; reason?: string } {
    const kickoff = new Date(input.scheduledTime).getTime();
    const now = Date.now();
    const diffDays = (kickoff - now) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      return { eligible: false, reason: 'fixture started' };
    }
    if (diffDays > 7.0) {
      return { eligible: false, reason: 'fixture kickoff > 7 days' };
    }
    if (!input.marketAvailable) {
      return { eligible: false, reason: 'market not available' };
    }
    if (!input.referenceBookAvailable) {
      return { eligible: false, reason: 'reference bookmaker not available' };
    }

    const config = getLeagueConfig(input.leagueId);
    const minLiquidity = config ? config.market_liquidity_score : 70;
    if (input.liquidityScore < minLiquidity) {
      return { eligible: false, reason: `market liquidity below threshold (${input.liquidityScore} < ${minLiquidity})` };
    }

    return { eligible: true };
  }

  /**
   * Evaluates a fixture and queues it if eligible.
   */
  public static async queueFixture(input: QueueEligibilityInput): Promise<boolean> {
    const check = this.checkEligibility(input);
    
    if (!check.eligible) {
      console.log(`[ValidationQueue] Fixture ${input.fixtureId} not eligible: ${check.reason}`);
      return false;
    }

    const { error } = await supabase
      .from('validation_queue')
      .upsert({
        fixture_id: input.fixtureId,
        league_id: String(input.leagueId),
        scheduled_time: new Date(input.scheduledTime).toISOString(),
        market_available: input.marketAvailable,
        reference_book_available: input.referenceBookAvailable,
        validation_status: 'queued',
        settled: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (error) {
      console.error(`[ValidationQueue] Failed to upsert fixture ${input.fixtureId}:`, error.message);
      return false;
    }

    console.log(`[ValidationQueue] Fixture ${input.fixtureId} successfully queued for live validation.`);
    return true;
  }
}
