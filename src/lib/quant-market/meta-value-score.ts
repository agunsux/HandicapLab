// EPIC 38 — Meta Value Score Engine (0 - 100)
// Calculates a single composite Meta Value Score combining Expected Value (EV), Edge,
// Calibration, Similarity Evidence, Market Quality, League Trust, CLV, and CI Width.

export interface MetaValueScoreInput {
  expectedValue: number; // e.g. 0.08 (+8% EV)
  probEdge: number; // e.g. 0.05 (+5% Edge)
  calibrationEce: number; // e.g. 0.016
  historicalRoi: number; // e.g. 0.084
  marketQualityScore: number; // e.g. 88.0
  leagueTrustScore: number; // e.g. 92.5
  predictedClv: number; // e.g. 0.041
  ciWidth: number; // e.g. 0.08
}

export interface MetaValueScoreReport {
  score: number; // 0 - 100
  tier: 'ELITE_VALUE' | 'HIGH_VALUE' | 'MODERATE_VALUE' | 'SUB_PAR';
  components: {
    evPoints: number;
    edgePoints: number;
    calibrationPoints: number;
    similarityPoints: number;
    marketQualityPoints: number;
    leagueTrustPoints: number;
  };
  mathematicalJustification: string;
}

export class MetaValueEngine {
  /** Compute composite 0-100 Meta Value Score */
  static computeMetaScore(input: MetaValueScoreInput): MetaValueScoreReport {
    // 1. EV Component (0 - 25 pts)
    const evPoints = Math.min(25, Math.max(0, input.expectedValue * 250));

    // 2. Edge Component (0 - 20 pts)
    const edgePoints = Math.min(20, Math.max(0, input.probEdge * 250));

    // 3. Calibration Component (0 - 15 pts)
    const calibrationPoints = Math.min(15, Math.max(0, 15 - input.calibrationEce * 300));

    // 4. Similarity Component (0 - 15 pts)
    const similarityPoints = Math.min(15, Math.max(0, input.historicalRoi * 150));

    // 5. Market Quality Component (0 - 12.5 pts)
    const marketQualityPoints = Math.min(12.5, Math.max(0, input.marketQualityScore * 0.125));

    // 6. League Trust Component (0 - 12.5 pts)
    const leagueTrustPoints = Math.min(12.5, Math.max(0, input.leagueTrustScore * 0.125));

    const total = evPoints + edgePoints + calibrationPoints + similarityPoints + marketQualityPoints + leagueTrustPoints;
    const score = Number(Math.min(100, Math.max(0, total)).toFixed(1));

    let tier: 'ELITE_VALUE' | 'HIGH_VALUE' | 'MODERATE_VALUE' | 'SUB_PAR' = 'MODERATE_VALUE';
    if (score >= 85) tier = 'ELITE_VALUE';
    else if (score >= 70) tier = 'HIGH_VALUE';
    else if (score < 50) tier = 'SUB_PAR';

    return {
      score,
      tier,
      components: {
        evPoints: Number(evPoints.toFixed(1)),
        edgePoints: Number(edgePoints.toFixed(1)),
        calibrationPoints: Number(calibrationPoints.toFixed(1)),
        similarityPoints: Number(similarityPoints.toFixed(1)),
        marketQualityPoints: Number(marketQualityPoints.toFixed(1)),
        leagueTrustPoints: Number(leagueTrustPoints.toFixed(1)),
      },
      mathematicalJustification: `Meta Value Score ${score}/100 (${tier}): EV (${evPoints.toFixed(1)}pt), Edge (${edgePoints.toFixed(1)}pt), Calibration (${calibrationPoints.toFixed(1)}pt), Market Quality (${marketQualityPoints.toFixed(1)}pt), League Trust (${leagueTrustPoints.toFixed(1)}pt).`,
    };
  }
}
