// Market Microstructure Analytics
// Location: src/lib/engine/microstructure-analyzer.ts

export interface MicrostructureMetrics {
  spread: number;
  overround: number;
  isStale: boolean;
  sharpLeadLatencySec?: number;
}

export class MicrostructureAnalyzer {
  /**
   * Computes the bid-ask spread proxy.
   * For binary markets (AH/OU), spread = (1/odds_1 + 1/odds_2) - 1
   * For ternary markets (ML), spread = (1/odds_1 + 1/odds_2 + 1/odds_3) - 1
   */
  public static calculateSpread(odds: Record<string, number>): number {
    let sumImplied = 0;
    let count = 0;
    for (const val of Object.values(odds)) {
      if (val && val > 1.0) {
        sumImplied += 1.0 / val;
        count++;
      }
    }
    if (count === 0) return 0.0;
    return Number((sumImplied - 1.0).toFixed(6));
  }

  /**
   * Evaluates if soft bookmaker odds are stale compared to sharp bookmaker odds.
   * If sharp odds changed significantly but soft odds haven't changed, they are flagged.
   */
  public static isStalePrice(
    softOdds: number,
    sharpOdds: number,
    threshold = 0.05
  ): boolean {
    if (!softOdds || !sharpOdds) return false;
    const diff = Math.abs(softOdds - sharpOdds) / sharpOdds;
    return diff > threshold;
  }

  /**
   * Measures sharp lead time.
   * Compares timestamps of when a sharp bookmaker line moved vs when a soft bookmaker matched the move.
   */
  public static calculateSharpLeadTime(
    sharpMoves: { price: number; timestamp: Date }[],
    softMoves: { price: number; timestamp: Date }[]
  ): number | undefined {
    if (sharpMoves.length === 0 || softMoves.length === 0) return undefined;

    // Find the latest sharp movement
    const latestSharp = sharpMoves[sharpMoves.length - 1];

    // Find the first soft movement matching this price direction within a 1-hour window after the sharp move
    const matchingSoft = softMoves.find(
      s =>
        s.timestamp >= latestSharp.timestamp &&
        s.timestamp.getTime() - latestSharp.timestamp.getTime() <= 3600 * 1000 &&
        Math.abs(s.price - latestSharp.price) < 0.02
    );

    if (!matchingSoft) return undefined;

    const delayMs = matchingSoft.timestamp.getTime() - latestSharp.timestamp.getTime();
    return Number((delayMs / 1000).toFixed(1));
  }
}
