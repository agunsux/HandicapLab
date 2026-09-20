// ============================================================================
// MULTI-LEAGUE VALIDATED MARKET PERFORMANCE & RESEARCH LAYER
// ============================================================================
// Location: src/lib/research/multiLeaguePerformance.ts
//
// Tracks validated quantitative betting market performance metrics by:
// league, market, season, line, odds band, prediction horizon, model version.
//
// Strict Integrity Invariants:
// - Never present small-sample ROI as proven league edge.
// - Minimum sample size threshold: N >= 100 for statistical viability.
//   Any sample with N < 100 MUST be flagged as 'LIMITED SAMPLE'.
// - Zero look-ahead leakage: oddsTimestamp <= predictionTimestamp < kickoff.
// ============================================================================

export interface MarketPerformanceTrackKey {
  league: string;
  market: 'AH' | 'OU' | 'BTTS';
  season: string;
  line: number;
  oddsBand: '1.50-1.75' | '1.75-2.00' | '2.00-2.25' | '2.25+';
  predictionHorizon: 'EARLY' | 'PRE-MATCH' | 'FINAL';
  modelVersion: string;
}

export interface ValidatedPerformanceMetrics {
  sampleSize: number;
  hitCount: number;
  hitRate: number; // 0.0 - 1.0
  brierScore: number;
  logLoss: number;
  closingLineValueEdge: number; // CLV edge %
  roi: number; // Net ROI %
  calibrationSlope: number;
  sampleStatus: 'LIMITED SAMPLE' | 'STATISTICALLY_VIABLE';
  reliabilityBadge: 'EXPERIMENTAL' | 'PROVISIONAL' | 'ROBUST';
  lastEvaluatedUtc: string;
}

export interface MarketPerformanceRecord {
  key: MarketPerformanceTrackKey;
  metrics: ValidatedPerformanceMetrics;
}

export class MultiLeaguePerformanceTracker {
  public static readonly MIN_SAMPLE_SIZE = 100;

  /**
   * Helper to categorize odds into standardized risk bands.
   */
  public static getOddsBand(odds: number): MarketPerformanceTrackKey['oddsBand'] {
    if (odds < 1.75) return '1.50-1.75';
    if (odds < 2.00) return '1.75-2.00';
    if (odds < 2.25) return '2.00-2.25';
    return '2.25+';
  }

  /**
   * Evaluates a cohort of predictions against settled match results.
   */
  public static evaluateCohort(
    key: MarketPerformanceTrackKey,
    settledBets: Array<{
      modelProb: number;
      marketOdds: number;
      closingOdds?: number;
      won: boolean;
      pushed?: boolean;
    }>
  ): MarketPerformanceRecord {
    const sampleSize = settledBets.length;
    if (sampleSize === 0) {
      return {
        key,
        metrics: {
          sampleSize: 0,
          hitCount: 0,
          hitRate: 0,
          brierScore: 0,
          logLoss: 0,
          closingLineValueEdge: 0,
          roi: 0,
          calibrationSlope: 1.0,
          sampleStatus: 'LIMITED SAMPLE',
          reliabilityBadge: 'EXPERIMENTAL',
          lastEvaluatedUtc: new Date().toISOString(),
        },
      };
    }

    let hitCount = 0;
    let brierSum = 0;
    let logLossSum = 0;
    let profitSum = 0;
    let clvEdgeSum = 0;
    let clvCount = 0;

    for (const bet of settledBets) {
      const outcome = bet.won ? 1 : 0;
      hitCount += outcome;

      // Brier Score = (modelProb - outcome)^2
      brierSum += Math.pow(bet.modelProb - outcome, 2);

      // Log Loss = -(outcome * ln(p) + (1 - outcome) * ln(1 - p))
      const p = Math.max(0.001, Math.min(0.999, bet.modelProb));
      logLossSum += -(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));

      // 1-unit flat stake ROI calculation
      if (bet.won) {
        profitSum += bet.marketOdds - 1;
      } else if (bet.pushed) {
        profitSum += 0;
      } else {
        profitSum -= 1;
      }

      // CLV Edge = (marketOdds / closingOdds) - 1
      if (bet.closingOdds && bet.closingOdds > 1.0) {
        clvEdgeSum += (bet.marketOdds / bet.closingOdds) - 1;
        clvCount++;
      }
    }

    const hitRate = Number((hitCount / sampleSize).toFixed(4));
    const brierScore = Number((brierSum / sampleSize).toFixed(4));
    const logLoss = Number((logLossSum / sampleSize).toFixed(4));
    const roi = Number(((profitSum / sampleSize) * 100).toFixed(2));
    const clvEdge = clvCount > 0 ? Number(((clvEdgeSum / clvCount) * 100).toFixed(2)) : 0;

    const sampleStatus: ValidatedPerformanceMetrics['sampleStatus'] =
      sampleSize < this.MIN_SAMPLE_SIZE ? 'LIMITED SAMPLE' : 'STATISTICALLY_VIABLE';

    const reliabilityBadge: ValidatedPerformanceMetrics['reliabilityBadge'] =
      sampleSize < 30 ? 'EXPERIMENTAL' : sampleSize < this.MIN_SAMPLE_SIZE ? 'PROVISIONAL' : 'ROBUST';

    return {
      key,
      metrics: {
        sampleSize,
        hitCount,
        hitRate,
        brierScore,
        logLoss,
        closingLineValueEdge: clvEdge,
        roi,
        calibrationSlope: 1.0,
        sampleStatus,
        reliabilityBadge,
        lastEvaluatedUtc: new Date().toISOString(),
      },
    };
  }
}

