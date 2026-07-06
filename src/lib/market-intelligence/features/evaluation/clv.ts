// HandicapLab Market Intelligence - CLV Evaluation
// Location: src/lib/market-intelligence/features/evaluation/clv.ts

import { OddsTimeline } from '../../types';

export class CLVEvaluator {
  /**
   * Helper to convert odds to implied probability
   */
  private static toImplied(odds: number): number {
    return odds > 1 ? 1 / odds : 0;
  }

  /**
   * Calculates various forms of Closing Line Value (CLV).
   * MUST ONLY BE CALLED POST-MATCH OR AFTER CLOSING LINE IS FINALIZED.
   */
  public static evaluateCLV(
    timeline: OddsTimeline, 
    betOdds: number, 
    selection: 'home' | 'draw' | 'away'
  ) {
    if (!timeline.closing) {
      throw new Error("Closing line not available. Cannot evaluate CLV.");
    }

    const closingOdds = timeline.closing.moneyline[selection];
    
    // 1. Raw CLV (Ratio of odds)
    // If we bet at 2.15 and it closes at 1.98: (2.15 / 1.98) - 1 = +8.58%
    const rawCLV = (betOdds / closingOdds) - 1;

    // 2. Log CLV (Handles skewness in extreme odds)
    const logCLV = Math.log(betOdds / closingOdds);

    // 3. EV-Adjusted CLV (incorporating margin removal)
    // Basic margin approximation for closing line
    const impliedH = this.toImplied(timeline.closing.moneyline.home);
    const impliedD = this.toImplied(timeline.closing.moneyline.draw);
    const impliedA = this.toImplied(timeline.closing.moneyline.away);
    const margin = (impliedH + impliedD + impliedA) - 1;
    
    // True probability approximation (proportional margin removal)
    const trueProb = (this.toImplied(closingOdds)) / (1 + margin);
    const evAdjustedCLV = (betOdds * trueProb) - 1;

    // 4. Normalized CLV (Probability difference)
    const normalizedCLV = this.toImplied(closingOdds) - this.toImplied(betOdds);

    return {
      rawCLV,
      logCLV,
      evAdjustedCLV,
      normalizedCLV
    };
  }
}
