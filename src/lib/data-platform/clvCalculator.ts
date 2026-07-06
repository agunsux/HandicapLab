// HandicapLab Data Platform - CLV Calculator
export interface CLVRecord {
  openingOdds: number;
  closingOdds: number;
  betTime: string; // ISO timestamp
  closingEdge: number;
  clv: number;
  positiveCLV: boolean;
}

export class CLVCalculator {
  /**
   * Calculates the Closing Line Value (CLV) percentage.
   */
  public static calculateCLV(oddsTaken: number, closingOdds: number): number {
    if (oddsTaken <= 1.0 || closingOdds <= 1.0) return 0;
    // Basic CLV formula: (oddsTaken / closingOdds) - 1
    return (oddsTaken / closingOdds) - 1.0;
  }

  /**
   * Aggregates CLV metrics across a set of bets.
   */
  public static aggregate(records: CLVRecord[]): { averageCLV: number, positiveCLVPercent: number, medianCLV: number } {
    if (records.length === 0) return { averageCLV: 0, positiveCLVPercent: 0, medianCLV: 0 };
    
    let sum = 0;
    let positiveCount = 0;
    const clvValues: number[] = [];

    for (const r of records) {
      sum += r.clv;
      if (r.clv > 0) positiveCount++;
      clvValues.push(r.clv);
    }

    clvValues.sort((a, b) => a - b);
    let medianCLV = 0;
    const mid = Math.floor(clvValues.length / 2);
    if (clvValues.length % 2 === 0) {
        medianCLV = (clvValues[mid - 1] + clvValues[mid]) / 2;
    } else {
        medianCLV = clvValues[mid];
    }

    return {
      averageCLV: sum / records.length,
      positiveCLVPercent: positiveCount / records.length,
      medianCLV
    };
  }
}
