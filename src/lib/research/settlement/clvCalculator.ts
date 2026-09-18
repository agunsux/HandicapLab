// ============================================================================
// CLOSING LINE VALUE (CLV) CALCULATOR
// ============================================================================
// Location: src/lib/research/settlement/clvCalculator.ts
//
// Calculates Closing Line Value (CLV) independently from realized ROI:
//   Standard Ratio CLV: (odds_taken / odds_closing) - 1.0
//   Vig-Adjusted CLV:   odds_taken * implied_closing_probability - 1.0
//
// Analyzes:
//   - Mean CLV
//   - Median CLV
//   - Positive CLV Rate (% of bets that beat closing line)
//   - Correlation with model edge
// ============================================================================

export interface ClvObservation {
  matchId: string;
  market: string;
  line: number | null;
  selection: string;
  predictionTimeOdds: number; // odds taken at T-horizon
  closingOdds: number;        // Pinnacle closing price strictly before kickoff
  deviggedClosingProb?: number;
}

export interface ClvSummaryResult {
  sampleSize: number;
  meanClv: number;           // in decimal percent (e.g. 0.024 => +2.4%)
  medianClv: number;
  positiveClvRate: number;   // fraction of bets where CLV > 0
  meanVigAdjustedClv?: number;
  divergenceAlert: boolean;  // True if positive ROI coexists with persistently negative CLV
}

export class ClvCalculator {
  /**
   * Computes individual ratio CLV for a single bet.
   */
  public static computeSingleClv(
    predictionTimeOdds: number,
    closingOdds: number
  ): number {
    if (predictionTimeOdds <= 1.0 || closingOdds <= 1.0) {
      throw new Error(`[ClvCalculator] Invalid odds: taken=${predictionTimeOdds}, closing=${closingOdds}`);
    }
    return Number(((predictionTimeOdds / closingOdds) - 1.0).toFixed(5));
  }

  /**
   * Computes aggregate CLV statistics across a collection of bets.
   */
  public static summarize(
    observations: ClvObservation[],
    realizedRoi?: number
  ): ClvSummaryResult {
    const n = observations.length;
    if (n === 0) {
      return {
        sampleSize: 0,
        meanClv: 0.0,
        medianClv: 0.0,
        positiveClvRate: 0.0,
        divergenceAlert: false,
      };
    }

    const clvValues: number[] = [];
    const vigAdjValues: number[] = [];
    let positiveCount = 0;

    for (const obs of observations) {
      const clv = this.computeSingleClv(obs.predictionTimeOdds, obs.closingOdds);
      clvValues.push(clv);
      if (clv > 0) positiveCount++;

      if (obs.deviggedClosingProb && obs.deviggedClosingProb > 0) {
        const vigAdj = obs.predictionTimeOdds * obs.deviggedClosingProb - 1.0;
        vigAdjValues.push(vigAdj);
      }
    }

    // Sort for median
    clvValues.sort((a, b) => a - b);
    const sum = clvValues.reduce((acc, v) => acc + v, 0);
    const meanClv = Number((sum / n).toFixed(5));

    const mid = Math.floor(n / 2);
    const medianClv = Number(
      (n % 2 !== 0 ? clvValues[mid] : (clvValues[mid - 1] + clvValues[mid]) / 2.0).toFixed(5)
    );

    const positiveClvRate = Number((positiveCount / n).toFixed(4));

    let meanVigAdjustedClv: number | undefined;
    if (vigAdjValues.length > 0) {
      const vigSum = vigAdjValues.reduce((acc, v) => acc + v, 0);
      meanVigAdjustedClv = Number((vigSum / vigAdjValues.length).toFixed(5));
    }

    // Divergence check: if realized ROI > +2% but mean CLV < -1%, flag anomaly
    const divergenceAlert =
      realizedRoi !== undefined && realizedRoi > 0.02 && meanClv < -0.01;

    return {
      sampleSize: n,
      meanClv,
      medianClv,
      positiveClvRate,
      meanVigAdjustedClv,
      divergenceAlert,
    };
  }
}

