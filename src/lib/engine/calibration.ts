import { supabase } from '../supabase.server';

export interface DynamicThresholds {
  AH: number;
  OU: number;
  ML: number;
  brierScore: number | null;
}

/**
 * Dynamic Calibration Engine.
 * Monitors model accuracy (Brier Score) of the last 100 settled signals
 * and adjusts minimum edge requirements to filter low-confidence selections.
 */
export class CalibrationEngine {
  /**
   * Evaluates the last 100 settled signals' Brier Score and returns the calibrated thresholds.
   * - Brier Score > 0.25 (worse than coin flip): Gradual tightening (+0.5% added: AH 3.5%, OU 4.5%, ML 5.5%).
   * - Brier Score < 0.20 (performing well): Gradual easing (-0.25% subtracted: AH 2.75%, OU 3.75%, ML 4.75%).
   * - Else: Standard/base thresholds (AH 3.0%, OU 4.0%, ML 5.0%).
   */
  public static async getDynamicThresholds(): Promise<DynamicThresholds> {
    const baseThresholds = { AH: 3.0, OU: 4.0, ML: 5.0 };

    try {
      // 1. Fetch last 100 settled signals
      const { data: signals, error } = await supabase
        .from('signals')
        .select('*')
        .not('settled_at', 'is', null)
        .order('settled_at', { ascending: false })
        .limit(100);

      if (error || !signals || signals.length === 0) {
        return { ...baseThresholds, brierScore: null };
      }

      let binaryBrierSum = 0;
      let binaryCount = 0;

      signals.forEach((sig) => {
        const prob = Number(sig.probability || 0.5);
        const status = (sig.status || '').toLowerCase();
        const market = (sig.market || '').toLowerCase();

        // Brier score only applies to binary outcome mappings in our framework (AH, OU)
        if (market === 'asian_handicap' || market === 'over_under') {
          let outcomeValue = 0.0;
          if (status === 'won' || status === 'win' || status === 'half_win') {
            outcomeValue = 1.0;
          } else if (status === 'push' || status === 'void') {
            outcomeValue = 0.5;
          } else if (status === 'half_loss') {
            outcomeValue = 0.0;
          } else {
            outcomeValue = 0.0;
          }

          binaryBrierSum += Math.pow(prob - outcomeValue, 2);
          binaryCount++;
        }
      });

      if (binaryCount < 10) {
        // Not enough binary signals to reliably calibrate yet
        return { ...baseThresholds, brierScore: null };
      }

      const brierScore = binaryBrierSum / binaryCount;

      // Adjust thresholds based on the calculated Brier Score
      if (brierScore > 0.30) {
        // Tighten further: add 1.0% to all minimum edge requirements
        return {
          AH: baseThresholds.AH + 1.0,
          OU: baseThresholds.OU + 1.0,
          ML: baseThresholds.ML + 1.0,
          brierScore
        };
      } else if (brierScore > 0.25) {
        // Tighten: add 0.5% to all minimum edge requirements
        return {
          AH: baseThresholds.AH + 0.5,
          OU: baseThresholds.OU + 0.5,
          ML: baseThresholds.ML + 0.5,
          brierScore
        };
      } else if (brierScore < 0.20) {
        // Relax: subtract 0.25% from all minimum edge requirements
        return {
          AH: baseThresholds.AH - 0.25,
          OU: baseThresholds.OU - 0.25,
          ML: baseThresholds.ML - 0.25,
          brierScore
        };
      }

      // Default to base thresholds in the intermediate range
      return {
        ...baseThresholds,
        brierScore
      };
    } catch (err) {
      console.error('[CalibrationEngine] Error calculating dynamic thresholds:', err);
      return { ...baseThresholds, brierScore: null };
    }
  }
}
