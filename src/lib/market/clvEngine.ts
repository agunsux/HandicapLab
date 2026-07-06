// HandicapLab Market Intelligence - CLV Engine
// Location: src/lib/market/clvEngine.ts

export interface CLVResult {
  openingOdds: number;
  currentOdds: number;
  closingOdds: number;
  openingProbability: number;
  closingProbability: number;
  clvPercent: number;
  clvDecimal: number;
  expectedEdge: number;
  edgeRetained: number;
  valueLost: number;
  valueGained: number;
  reasons: string[];
}

export class CLVEngine {
  /**
   * Converts decimal odds to implied probability.
   */
  public static toImplied(odds: number): number {
    return odds > 1 ? 1 / odds : 0;
  }

  /**
   * Deterministically calculates Closing Line Value (CLV) metrics from snapshots.
   */
  public static calculate(
    openingOdds: number,
    currentOdds: number,
    closingOdds: number,
    marginAvg: number = 0.025
  ): CLVResult {
    // Proportional true probabilities (approx. from margin removal)
    const openingProbability = Number((this.toImplied(openingOdds) / (1 + marginAvg)).toFixed(4));
    const closingProbability = Number((this.toImplied(closingOdds) / (1 + marginAvg)).toFixed(4));

    // CLV (%) = (currentOdds / closingOdds - 1) * 100
    // CLV (Decimal) = currentOdds / closingOdds - 1
    const clvDecimal = currentOdds / closingOdds - 1;
    const clvPercent = clvDecimal * 100;

    // Expected Edge = (currentOdds * openingProbability) - 1
    const expectedEdge = (currentOdds * openingProbability) - 1;
    const edgeRetained = clvDecimal;

    // Value Lost / Gained logic
    const valueGained = clvDecimal > 0 ? clvDecimal : 0;
    const valueLost = clvDecimal < 0 ? Math.abs(clvDecimal) : 0;

    const reasons: string[] = [];
    if (clvPercent > 3.0) {
      reasons.push(`Prediction beat closing line by ${clvPercent.toFixed(1)}%`);
      reasons.push('Market consensus aligned to prediction direction');
      reasons.push('Value Gained registered');
    } else if (clvPercent < -3.0) {
      reasons.push(`Prediction lost to closing line by ${Math.abs(clvPercent).toFixed(1)}%`);
      reasons.push('Late market movement against prediction');
      reasons.push('Value Lost registered');
    } else {
      reasons.push('Odds remained stable at closing');
      reasons.push('Prediction maintained edge near market expectation');
    }

    return {
      openingOdds,
      currentOdds,
      closingOdds,
      openingProbability,
      closingProbability,
      clvPercent: Number(clvPercent.toFixed(2)),
      clvDecimal: Number(clvDecimal.toFixed(4)),
      expectedEdge: Number(expectedEdge.toFixed(4)),
      edgeRetained: Number(edgeRetained.toFixed(4)),
      valueLost: Number(valueLost.toFixed(4)),
      valueGained: Number(valueGained.toFixed(4)),
      reasons
    };
  }
}
