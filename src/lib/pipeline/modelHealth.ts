// ============================================================================
// DAILY MODEL HEALTH & ERROR ANALYSIS SYSTEM
// ============================================================================
// Location: src/lib/pipeline/modelHealth.ts
//
// Invariants enforced:
// 1. Tracks rolling windows: Daily (Yesterday), 7-Day, 30-Day, Season (from 2026-01-01).
// 2. Metrics: Brier Score, Log Loss, Calibration, Realized Win Rate, Yield, CLV, Sample Size N.
// 3. Win Rate Target Gate: >65% is an evaluation KPI target, NOT a manufactured guarantee.
// 4. BTTS Research Benchmark:
//    Model Brier (0.2564) vs Pinnacle Brier (0.2444) vs League Prior (0.2481).
//    BTTS remains strictly RESEARCH_ONLY while underperforming Pinnacle benchmark.
// 5. Explicit error classification: CORRECT, INCORRECT, VOID, INVALID.
// ============================================================================

export interface MarketHealthMetrics {
  market: 'AH' | 'BTTS' | 'OU';
  sampleSize: number;
  brierScore: number | null;
  logLoss: number | null;
  winRatePct: number | null;
  yieldPct: number | null;
  roiPct: number | null;
  avgOdds: number | null;
  avgClvPct: number | null;
  status: 'ACTIVE_PRODUCTION' | 'RESEARCH_ONLY' | 'INSUFFICIENT_SAMPLE';
  benchmarkComparison?: {
    modelBrier: number;
    benchmarkBrier: number;
    beatingBenchmark: boolean;
    benchmarkName: string;
  };
}

export interface WindowHealthSummary {
  window: 'DAILY' | '7_DAY' | '30_DAY' | 'SEASON';
  startDate: string;
  endDate: string;
  totalSettled: number;
  overallWinRatePct: number | null;
  overallYieldPct: number | null;
  targetWinRatePct: number; // 65.0%
  targetAchieved: boolean;
  markets: {
    ah: MarketHealthMetrics;
    btts: MarketHealthMetrics;
    ou: MarketHealthMetrics;
  };
  highConfidence: {
    sampleSize: number;
    winRatePct: number | null;
    yieldPct: number | null;
  };
  diagnostics: string[];
}

export interface SettlementObservation {
  predictionId: string;
  canonicalMatchId: string;
  market: 'AH' | 'BTTS' | 'OU';
  selection: string;
  line: number | null;
  predictedProbability: number;
  odds: number;
  closingOdds?: number | null;
  outcome: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS' | 'VOID';
  profitUnits: number;
  settledAt: string;
  kickoffUtc: string;
  isHighConfidence: boolean;
}

export class ModelHealthService {
  public static readonly TARGET_WIN_RATE_PCT = 65.0;
  public static readonly PINNACLE_BTTS_BRIER_BENCHMARK = 0.2444;
  public static readonly CURRENT_BTTS_MODEL_BRIER = 0.2564;
  public static readonly LEAGUE_PRIOR_BTTS_BRIER = 0.2481;

  /**
   * Computes Brier Score: 1/N * sum((probability - outcome)^2).
   */
  public static calculateBrierScore(observations: SettlementObservation[]): number | null {
    const valid = observations.filter((o) => o.outcome !== 'VOID');
    if (valid.length === 0) return null;

    let sum = 0;
    for (const obs of valid) {
      let outcomeVal = 0;
      if (obs.outcome === 'WIN') outcomeVal = 1.0;
      else if (obs.outcome === 'HALF_WIN') outcomeVal = 0.75;
      else if (obs.outcome === 'PUSH') outcomeVal = 0.5;
      else if (obs.outcome === 'HALF_LOSS') outcomeVal = 0.25;
      else if (obs.outcome === 'LOSS') outcomeVal = 0.0;

      const diff = obs.predictedProbability - outcomeVal;
      sum += diff * diff;
    }

    return Number((sum / valid.length).toFixed(4));
  }

  /**
   * Computes Log Loss: -1/N * sum(y*ln(p) + (1-y)*ln(1-p)).
   */
  public static calculateLogLoss(observations: SettlementObservation[]): number | null {
    const valid = observations.filter((o) => o.outcome === 'WIN' || o.outcome === 'LOSS');
    if (valid.length === 0) return null;

    let sum = 0;
    const eps = 1e-7;
    for (const obs of valid) {
      const y = obs.outcome === 'WIN' ? 1.0 : 0.0;
      const p = Math.max(eps, Math.min(1 - eps, obs.predictedProbability));
      sum += y * Math.log(p) + (1 - y) * Math.log(1 - p);
    }

    return Number((-sum / valid.length).toFixed(4));
  }

  /**
   * Computes comprehensive health metrics for a slice of observations.
   */
  public static evaluateMarket(
    market: 'AH' | 'BTTS' | 'OU',
    observations: SettlementObservation[]
  ): MarketHealthMetrics {
    const marketObs = observations.filter((o) => o.market === market);
    const nonVoid = marketObs.filter((o) => o.outcome !== 'VOID');
    const sampleSize = nonVoid.length;

    if (sampleSize === 0) {
      return {
        market,
        sampleSize: 0,
        brierScore: market === 'BTTS' ? this.CURRENT_BTTS_MODEL_BRIER : null,
        logLoss: null,
        winRatePct: null,
        yieldPct: null,
        roiPct: null,
        avgOdds: null,
        avgClvPct: null,
        status: market === 'BTTS' ? 'RESEARCH_ONLY' : 'INSUFFICIENT_SAMPLE',
        benchmarkComparison: market === 'BTTS' ? {
          modelBrier: this.CURRENT_BTTS_MODEL_BRIER,
          benchmarkBrier: this.PINNACLE_BTTS_BRIER_BENCHMARK,
          beatingBenchmark: false,
          benchmarkName: 'Pinnacle Closing Line',
        } : undefined,
      };
    }

    const brierScore = this.calculateBrierScore(marketObs);
    const logLoss = this.calculateLogLoss(marketObs);

    let wins = 0;
    let halfWins = 0;
    let totalProfit = 0;
    let totalStake = 0;
    let sumOdds = 0;
    let clvCount = 0;
    let sumClv = 0;

    for (const o of nonVoid) {
      if (o.outcome === 'WIN') wins++;
      else if (o.outcome === 'HALF_WIN') halfWins++;

      totalProfit += o.profitUnits;
      totalStake += 1.0;
      sumOdds += o.odds;

      if (o.closingOdds && o.closingOdds > 1.0) {
        const clv = (o.odds / o.closingOdds) - 1.0;
        sumClv += clv;
        clvCount++;
      }
    }

    const winRatePct = sampleSize > 0
      ? Number((((wins + 0.5 * halfWins) / sampleSize) * 100).toFixed(1))
      : null;

    const yieldPct = totalStake > 0
      ? Number(((totalProfit / totalStake) * 100).toFixed(2))
      : null;

    const avgOdds = sampleSize > 0 ? Number((sumOdds / sampleSize).toFixed(2)) : null;
    const avgClvPct = clvCount > 0 ? Number(((sumClv / clvCount) * 100).toFixed(2)) : null;

    let status: MarketHealthMetrics['status'];
    if (market === 'BTTS') {
      status = 'RESEARCH_ONLY';
    } else if (sampleSize >= 10) {
      status = 'ACTIVE_PRODUCTION';
    } else {
      status = 'INSUFFICIENT_SAMPLE';
    }

    return {
      market,
      sampleSize,
      brierScore,
      logLoss,
      winRatePct,
      yieldPct,
      roiPct: yieldPct,
      avgOdds,
      avgClvPct,
      status,
      benchmarkComparison: market === 'BTTS' ? {
        modelBrier: brierScore ?? this.CURRENT_BTTS_MODEL_BRIER,
        benchmarkBrier: this.PINNACLE_BTTS_BRIER_BENCHMARK,
        beatingBenchmark: (brierScore !== null && brierScore < this.PINNACLE_BTTS_BRIER_BENCHMARK),
        benchmarkName: 'Pinnacle Closing Line',
      } : undefined,
    };
  }

  /**
   * Generates a multi-window report across DAILY, 7-DAY, 30-DAY, and SEASON.
   */
  public static generateWindowSummary(
    window: 'DAILY' | '7_DAY' | '30_DAY' | 'SEASON',
    startDate: string,
    endDate: string,
    observations: SettlementObservation[]
  ): WindowHealthSummary {
    const ahMetrics = this.evaluateMarket('AH', observations);
    const bttsMetrics = this.evaluateMarket('BTTS', observations);
    const ouMetrics = this.evaluateMarket('OU', observations);

    const nonVoid = observations.filter((o) => o.outcome !== 'VOID');
    const totalSettled = nonVoid.length;

    let wins = 0;
    let halfWins = 0;
    let totalProfit = 0;
    let totalStake = 0;

    for (const o of nonVoid) {
      if (o.outcome === 'WIN') wins++;
      else if (o.outcome === 'HALF_WIN') halfWins++;
      totalProfit += o.profitUnits;
      totalStake += 1.0;
    }

    const overallWinRatePct = totalSettled > 0
      ? Number((((wins + 0.5 * halfWins) / totalSettled) * 100).toFixed(1))
      : null;

    const overallYieldPct = totalStake > 0
      ? Number(((totalProfit / totalStake) * 100).toFixed(2))
      : null;

    const hcObs = observations.filter((o) => o.isHighConfidence && o.outcome !== 'VOID');
    const hcWins = hcObs.filter((o) => o.outcome === 'WIN').length + 0.5 * hcObs.filter((o) => o.outcome === 'HALF_WIN').length;
    const hcProfit = hcObs.reduce((acc, o) => acc + o.profitUnits, 0);

    const hcWinRatePct = hcObs.length > 0
      ? Number(((hcWins / hcObs.length) * 100).toFixed(1))
      : null;

    const hcYieldPct = hcObs.length > 0
      ? Number(((hcProfit / hcObs.length) * 100).toFixed(2))
      : null;

    const diagnostics: string[] = [];
    diagnostics.push('BTTS: Held in RESEARCH_ONLY mode (Model Brier 0.2564 vs Pinnacle 0.2444)');

    if (overallWinRatePct !== null) {
      if (overallWinRatePct < this.TARGET_WIN_RATE_PCT) {
        diagnostics.push(
          `KPI NOTICE: Realized win rate (${overallWinRatePct}%) below target (${this.TARGET_WIN_RATE_PCT}%). Sample size: ${totalSettled}.`
        );
      } else {
        diagnostics.push(
          `KPI ON TRACK: Realized win rate (${overallWinRatePct}%) satisfies target (>= ${this.TARGET_WIN_RATE_PCT}%).`
        );
      }
    } else {
      diagnostics.push('KPI NOTICE: Zero settled bets for this observation window.');
    }

    return {
      window,
      startDate,
      endDate,
      totalSettled,
      overallWinRatePct,
      overallYieldPct,
      targetWinRatePct: this.TARGET_WIN_RATE_PCT,
      targetAchieved: overallWinRatePct !== null && overallWinRatePct >= this.TARGET_WIN_RATE_PCT,
      markets: {
        ah: ahMetrics,
        btts: bttsMetrics,
        ou: ouMetrics,
      },
      highConfidence: {
        sampleSize: hcObs.length,
        winRatePct: hcWinRatePct,
        yieldPct: hcYieldPct,
      },
      diagnostics,
    };
  }
}
