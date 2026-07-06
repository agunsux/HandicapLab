// HandicapLab Decision Engine v1 - Value Engine
// Location: src/lib/engines/decision-engine-v1/value-engine.ts

export interface ValueCalculation {
  fairOdds: number;
  edge: number;
  expectedValue: number; // percentage EV
}

export class ValueEngine {
  /**
   * Calculates fair odds, raw edge, and Expected Value (EV).
   */
  public static calculate(probability: number, marketOdds: number): ValueCalculation {
    if (probability <= 0) {
      return { fairOdds: 99.0, edge: 0, expectedValue: 0 };
    }

    const fairOdds = Number((1 / probability).toFixed(3));
    
    // EV = (probability * marketOdds) - 1
    const expectedValue = (probability * marketOdds) - 1.0;
    const edge = expectedValue * 100; // expressed as percentage

    return {
      fairOdds,
      edge: Number(edge.toFixed(2)),
      expectedValue: Number((expectedValue * 100).toFixed(2))
    };
  }
}
