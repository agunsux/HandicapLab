import { CLVCalculator } from '../../settlement/clv-calculator';

export class ClvTracker {
  /**
   * Tracks Closing Line Value (CLV) by delegating to CLVCalculator.
   */
  public static calculateClv(
    betOdds: number,
    closingOdds: number | null | undefined
  ): number | null {
    return CLVCalculator.calculate(betOdds, closingOdds);
  }
}
