export class ClvTracker {
  /**
   * Tracks Closing Line Value (CLV).
   * CLV = (betOdds / closingOdds) - 1
   * Measures the value gained by betting early before the line closed.
   * A positive CLV means the user secured better odds than the market closed at.
   * 
   * @param betOdds Odds when bet was placed / predicted (e.g. 2.10)
   * @param closingOdds Closing market odds (e.g. 1.95)
   */
  public static calculateClv(
    betOdds: number,
    closingOdds: number | null | undefined
  ): number | null {
    if (!closingOdds || closingOdds <= 1.0 || betOdds <= 1.0) {
      return null;
    }
    const clv = (betOdds / closingOdds) - 1;
    return Number(clv.toFixed(4));
  }
}
