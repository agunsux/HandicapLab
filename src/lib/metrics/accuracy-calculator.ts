import { supabase } from '../supabase.server';
import { CalibrationError, CalibrationBucket } from './calibration-error';
import { ReliabilityChecker, ReliabilityResult } from './reliability';
import { EdgeScanner } from '../engines/edge-scanner';
import { ConfidenceScanner } from '../engines/edge-scanner/confidence';
import { ProbabilityOutput } from '../engines/probability-engine/types';

export interface MarketMetrics {
  totalPredictions: number;
  winRate: number;
  roi: number;
  avgBrierScore: number;
  avgCLV: number | null;
  totalProfit: number;
  insufficient_sample?: boolean;
  status?: 'sufficient' | 'insufficient_sample';
  requiredForClv?: number;
}

export interface AccuracyMetricsResult {
  overall: {
    totalPredictions: number;
    winRate: number;
    roi: number;
    avgBrierScore: number;
    avgCLV: number | null;
    totalProfit: number;
    totalStakes: number;
    insufficient_sample?: boolean;
    status?: 'sufficient' | 'insufficient_sample';
    requiredForClv?: number;
  };
  reliability: ReliabilityResult;
  calibration: {
    error: number;
    buckets: CalibrationBucket[];
  };
  byMarket: {
    ML: MarketMetrics;
    AH: MarketMetrics;
    OU: MarketMetrics;
  };
  byLeague: Record<string, MarketMetrics>;
  byConfidence: {
    LOW: MarketMetrics;
    MEDIUM: MarketMetrics;
    HIGH: MarketMetrics;
  };
  modelVersion: string;
  dateRange: { start: Date; end: Date };
  cachedAt: Date;
}

// In-memory cache helper
const metricsCache = new Map<string, { data: AccuracyMetricsResult; expiresAt: number }>();

export class AccuracyCalculator {
  /**
   * Helper to initialize empty/default metrics structure.
   */
  private static createEmptyMetrics(): MarketMetrics {
    return {
      totalPredictions: 0,
      winRate: 0,
      roi: 0,
      avgBrierScore: 0,
      avgCLV: null,
      totalProfit: 0,
      insufficient_sample: true,
      status: 'insufficient_sample',
      requiredForClv: 50
    };
  }

  /**
   * Helper to perform running aggregations on groups of prediction rows.
   */
  private static aggregateGroup(
    rows: Array<{
      profit: number;
      stake: number;
      brierScore: number | null;
      clv: number | null;
      isWin: boolean;
    }>
  ): MarketMetrics {
    const totalPredictions = rows.length;
    if (totalPredictions === 0) return this.createEmptyMetrics();

    let wins = 0;
    let totalProfit = 0;
    let totalStakes = 0;
    let brierSum = 0;
    let brierCount = 0;
    let clvSum = 0;
    let clvCount = 0;

    for (const r of rows) {
      if (r.isWin) wins++;
      totalProfit += r.profit;
      totalStakes += r.stake;
      if (r.brierScore !== null) {
        brierSum += r.brierScore;
        brierCount++;
      }
      if (r.clv !== null) {
        clvSum += r.clv;
        clvCount++;
      }
    }

    const winRate = wins / totalPredictions;
    const roi = totalStakes > 0 ? (totalProfit / totalStakes) * 100 : 0;
    const avgBrierScore = brierCount > 0 ? brierSum / brierCount : 0.25;
    const insufficientSample = totalPredictions < 50;
    const avgCLV = (insufficientSample || clvCount === 0) ? null : (clvSum / clvCount) * 100;

    return {
      totalPredictions,
      winRate: Number(winRate.toFixed(4)),
      roi: Number(roi.toFixed(2)),
      avgBrierScore: Number(avgBrierScore.toFixed(4)),
      avgCLV: avgCLV !== null ? Number(avgCLV.toFixed(2)) : null,
      totalProfit: Number(totalProfit.toFixed(4)),
      insufficient_sample: insufficientSample,
      status: insufficientSample ? 'insufficient_sample' : 'sufficient',
      requiredForClv: 50
    };
  }

  /**
   * Main performance calculation handler. Exposes ROI, Brier score, CLV, ECE,
   * reliability, and category breakdowns. Uses 5-minute memory TTL caching.
   */
  public static async getMetrics(filters: {
    model_version?: string;
    market_type?: string;
    days?: number;
  } = {}): Promise<AccuracyMetricsResult> {
    const cacheKey = JSON.stringify(filters);
    const cached = metricsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const days = filters.days || 30;
    const modelVersion = filters.model_version || 'prematch-v1';
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Fetch prediction_results joined with predictions and matches
    const { data: results, error } = await supabase
      .from('prediction_results')
      .select(`
        id,
        actual_home_score,
        actual_away_score,
        hit_1x2,
        hit_ah,
        hit_ou,
        profit_1x2,
        profit_ah,
        profit_ou,
        predictions!inner (
          id,
          match_id,
          market_type,
          prediction,
          odds_snapshot,
          closing_odds,
          model_version,
          brier_score,
          clv,
          created_at
        ),
        matches!inner (
          id,
          league,
          kickoff
        )
      `);

    if (error || !results) {
      throw new Error(`[AccuracyCalculator] Failed to retrieve historical predictions: ${error?.message || 'Empty set'}`);
    }

    // Raw shape returned by Supabase PostgREST for FK joins.
    // Because prediction_results.prediction_id and prediction_results.match_id
    // lack UNIQUE constraints, PostgREST treats embedded relations as arrays
    // (one-to-many cardinality), even though at runtime there is exactly one
    // related row per FK.
    interface RawPredictionResult {
      id: number;
      actual_home_score: number | null;
      actual_away_score: number | null;
      hit_1x2: boolean | null;
      hit_ah: boolean | null;
      hit_ou: boolean | null;
      profit_1x2: number | null;
      profit_ah: number | null;
      profit_ou: number | null;
      predictions: Array<{
        id: number;
        match_id: number;
        market_type: string;
        prediction: ProbabilityOutput;
        odds_snapshot: Record<string, unknown>;
        closing_odds: Record<string, unknown>;
        model_version: string;
        brier_score: number | null;
        clv: number | null;
        created_at: string;
      }>;
      matches: Array<{
        id: number;
        league: string;
        kickoff: string;
      }>;
    }

    // Normalised domain type – each prediction_result correlates to exactly
    // one prediction and one match, so we collapse the array wrappers.
    interface NormalisedRow {
      id: number;
      actual_home_score: number | null;
      actual_away_score: number | null;
      hit_1x2: boolean | null;
      hit_ah: boolean | null;
      hit_ou: boolean | null;
      profit_1x2: number | null;
      profit_ah: number | null;
      profit_ou: number | null;
      prediction: {
        id: number;
        match_id: number;
        market_type: string;
        prediction: ProbabilityOutput;
        odds_snapshot: Record<string, unknown>;
        closing_odds: Record<string, unknown>;
        model_version: string;
        brier_score: number | null;
        clv: number | null;
        created_at: string;
      };
      match: {
        id: number;
        league: string;
        kickoff: string;
      };
    }

    // Map raw Supabase rows (with array wrappers) into normalised domain rows
    // (single objects). Each FK join returns exactly one element at runtime.
    function normaliseRow(raw: RawPredictionResult): NormalisedRow | null {
      const prediction = raw.predictions?.[0];
      const match = raw.matches?.[0];
      if (!prediction || !match) return null;
      return {
        id: raw.id,
        actual_home_score: raw.actual_home_score,
        actual_away_score: raw.actual_away_score,
        hit_1x2: raw.hit_1x2,
        hit_ah: raw.hit_ah,
        hit_ou: raw.hit_ou,
        profit_1x2: raw.profit_1x2,
        profit_ah: raw.profit_ah,
        profit_ou: raw.profit_ou,
        prediction,
        match,
      };
    }

    const rawRows = results as RawPredictionResult[];
    const normalisedRows: NormalisedRow[] = [];
    for (const raw of rawRows) {
      const n = normaliseRow(raw);
      if (n) normalisedRows.push(n);
    }

    // Filter normalised rows locally to handle dynamic filtering criteria safely
    const filteredResults = normalisedRows.filter((row) => {
      const pred = row.prediction;

      // Filter by model version
      if (pred.model_version !== modelVersion) return false;

      // Filter by market type
      if (filters.market_type && pred.market_type !== filters.market_type) return false;

      // Filter by date range (predictions created within target timeframe)
      const createdTime = new Date(pred.created_at).getTime();
      return createdTime >= startDate.getTime();
    });

    // 2. Query total finished matches in this timeframe for coverage check
    const { count: totalMatches, error: countErr } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'finished')
      .gt('kickoff', startDate.toISOString());

    if (countErr) {
      console.warn('[AccuracyCalculator] Failed to query finished matches count:', countErr);
    }

    // 3. Process records, compute individual stakes, probabilities, and partition them
    const uniqueMatchIds = new Set<string>();
    const calibrationInputs: Array<{ probability: number; actual: number }> = [];
    
    interface AggregationRow {
      profit: number;
      stake: number;
      brierScore: number | null;
      clv: number | null;
      isWin: boolean;
      league: string;
      confidence: 'LOW' | 'MEDIUM' | 'HIGH';
      marketType: 'ML' | 'AH' | 'OU';
    }

    const processedRows: AggregationRow[] = [];

    for (const row of filteredResults) {
      const pred = row.prediction;
      const match = row.match;
      const marketType = pred.market_type as 'ML' | 'AH' | 'OU';

      uniqueMatchIds.add(String(pred.match_id));

      const profit = marketType === 'ML'
        ? Number(row.profit_1x2)
        : marketType === 'AH'
          ? Number(row.profit_ah)
          : Number(row.profit_ou);

      // Reconstruct the Kelly stake or fallback stake
      const oddsSnap = pred.odds_snapshot || {};
      const closeSnap = pred.closing_odds || {};
      const picks = EdgeScanner.scan(String(pred.match_id), marketType, pred.prediction, oddsSnap, closeSnap);

      let stake = 1.0;
      let prob = 0.5;
      if (picks.length > 0) {
        stake = picks[0].kellyStake > 0 ? picks[0].kellyStake : 0.05;
        prob = picks[0].modelProbability;
      } else {
        // Fallback probability mappings using typed ProbabilityOutput fields
        if (marketType === 'ML') {
          prob = Math.max(pred.prediction.pHome || 0, pred.prediction.pDraw || 0, pred.prediction.pAway || 0);
        } else if (marketType === 'AH') {
          const line = Number(oddsSnap.line) || 0;
          const lineKey = line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1);
          prob = pred.prediction.pAhHome?.[lineKey] || 0.5;
        } else if (marketType === 'OU') {
          const line = Number(oddsSnap.line) || 2.5;
          const lineKey = line.toFixed(1);
          prob = pred.prediction.pOver?.[lineKey] || 0.5;
        }
      }

      const isWin = profit > 0;
      const confidence = ConfidenceScanner.getConfidence(prob);
      const league = match.league || 'Unknown';

      processedRows.push({
        profit,
        stake,
        brierScore: pred.brier_score !== null ? Number(pred.brier_score) : null,
        clv: pred.clv !== null ? Number(pred.clv) : null,
        isWin,
        league,
        confidence,
        marketType
      });

      calibrationInputs.push({
        probability: prob,
        actual: isWin ? 1 : 0
      });
    }

    // 4. Compute overall metrics
    const overallAgg = this.aggregateGroup(processedRows);
    let totalStakes = 0;
    for (const r of processedRows) totalStakes += r.stake;

    // 5. Compute ECE
    const calibration = CalibrationError.calculate(calibrationInputs);

    // 6. Compute Reliability
    const coverageDenominator = totalMatches !== null && totalMatches > 0 ? totalMatches : 1;
    const coverage = Math.min(1.0, uniqueMatchIds.size / coverageDenominator);
    const reliability = ReliabilityChecker.check({
      sampleSize: processedRows.length,
      avgBrierScore: overallAgg.avgBrierScore,
      coverage
    });

    // 7. Compute breakdowns
    const byMarket = {
      ML: this.aggregateGroup(processedRows.filter(r => r.marketType === 'ML')),
      AH: this.aggregateGroup(processedRows.filter(r => r.marketType === 'AH')),
      OU: this.aggregateGroup(processedRows.filter(r => r.marketType === 'OU'))
    };

    // League breakdown
    const leagueGroups: Record<string, AggregationRow[]> = {};
    for (const r of processedRows) {
      if (!leagueGroups[r.league]) leagueGroups[r.league] = [];
      leagueGroups[r.league].push(r);
    }
    const byLeague: Record<string, MarketMetrics> = {};
    for (const [league, rows] of Object.entries(leagueGroups)) {
      byLeague[league] = this.aggregateGroup(rows);
    }

    // Confidence breakdown
    const byConfidence = {
      LOW: this.aggregateGroup(processedRows.filter(r => r.confidence === 'LOW')),
      MEDIUM: this.aggregateGroup(processedRows.filter(r => r.confidence === 'MEDIUM')),
      HIGH: this.aggregateGroup(processedRows.filter(r => r.confidence === 'HIGH'))
    };

    const finalResult: AccuracyMetricsResult = {
      overall: {
        totalPredictions: overallAgg.totalPredictions,
        winRate: overallAgg.winRate,
        roi: overallAgg.roi,
        avgBrierScore: overallAgg.avgBrierScore,
        avgCLV: overallAgg.avgCLV,
        totalProfit: overallAgg.totalProfit,
        totalStakes: Number(totalStakes.toFixed(4)),
        insufficient_sample: overallAgg.insufficient_sample,
        status: overallAgg.status,
        requiredForClv: overallAgg.requiredForClv
      },
      reliability,
      calibration,
      byMarket,
      byLeague,
      byConfidence,
      modelVersion,
      dateRange: { start: startDate, end: new Date() },
      cachedAt: new Date()
    };

    // Store in cache with 5 minute TTL (300 seconds)
    metricsCache.set(cacheKey, {
      data: finalResult,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    return finalResult;
  }
}
