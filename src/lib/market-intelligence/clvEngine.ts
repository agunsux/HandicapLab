/**
 * HANDICAP_LAB — Closing Price & Closing Line Value (CLV) Engine (Phases 12 & 13)
 * ==============================================================================
 * Independent calculation of Closing Line Value:
 * - Odds Ratio: (Entry_Odds / Closing_Odds) - 1
 * - Implied Probability Delta: Closing_Implied_Prob - Entry_Implied_Prob
 * - Close Quality Classification: VERIFIED_CLOSE | PROXY_CLOSE | NO_CLOSE
 * - Multi-dimensional breakdowns: by market, by bookmaker, by league, by EV threshold
 */

export type CloseQuality = 'VERIFIED_CLOSE' | 'PROXY_CLOSE' | 'NO_CLOSE';

export interface ClvRecord {
  match_id: string;
  league: string;
  bookmaker: string;
  market: string;
  selection: string;
  line: number | null;
  entry_odds: number;
  closing_odds: number | null;
  entry_implied_prob: number;
  closing_implied_prob: number | null;
  clv_ratio: number | null;
  clv_prob_delta: number | null;
  clv_direction: 'BEAT_LINE' | 'EQUAL' | 'LOST_TO_LINE' | 'UNAVAILABLE';
  close_quality: CloseQuality;
  ev_threshold_bucket?: string;
}

export interface ClvAggregation {
  sample_size: number;
  mean_clv: number | null;
  median_clv: number | null;
  positive_clv_pct: number | null;
  verified_close_pct: number;
  proxy_close_pct: number;
}

export class ClvEngine {
  /**
   * Phase 12 & 13: Calculate CLV record independently.
   */
  public static calculateCLV(params: {
    match_id: string;
    league: string;
    bookmaker: string;
    market: string;
    selection: string;
    line?: number | null;
    entry_odds: number;
    closing_odds: number | null;
    close_quality: CloseQuality;
    ev?: number;
  }): ClvRecord {
    const entryProb = 1.0 / params.entry_odds;

    if (!params.closing_odds || params.closing_odds <= 1.0 || params.close_quality === 'NO_CLOSE') {
      return {
        match_id: params.match_id,
        league: params.league,
        bookmaker: params.bookmaker,
        market: params.market,
        selection: params.selection,
        line: params.line ?? null,
        entry_odds: params.entry_odds,
        closing_odds: null,
        entry_implied_prob: Number(entryProb.toFixed(4)),
        closing_implied_prob: null,
        clv_ratio: null,
        clv_prob_delta: null,
        clv_direction: 'UNAVAILABLE',
        close_quality: 'NO_CLOSE',
      };
    }

    const closeProb = 1.0 / params.closing_odds;
    const clvRatio = (params.entry_odds / params.closing_odds) - 1.0;
    const probDelta = closeProb - entryProb;

    let direction: ClvRecord['clv_direction'] = 'EQUAL';
    if (clvRatio > 0.0001) direction = 'BEAT_LINE';
    else if (clvRatio < -0.0001) direction = 'LOST_TO_LINE';

    let evBucket = '<0%';
    if (params.ev !== undefined) {
      if (params.ev >= 0.10) evBucket = '≥10%';
      else if (params.ev >= 0.05) evBucket = '5-10%';
      else if (params.ev >= 0.03) evBucket = '3-5%';
      else if (params.ev >= 0.01) evBucket = '1-3%';
    }

    return {
      match_id: params.match_id,
      league: params.league,
      bookmaker: params.bookmaker,
      market: params.market,
      selection: params.selection,
      line: params.line ?? null,
      entry_odds: Number(params.entry_odds.toFixed(3)),
      closing_odds: Number(params.closing_odds.toFixed(3)),
      entry_implied_prob: Number(entryProb.toFixed(4)),
      closing_implied_prob: Number(closeProb.toFixed(4)),
      clv_ratio: Number(clvRatio.toFixed(4)),
      clv_prob_delta: Number(probDelta.toFixed(4)),
      clv_direction: direction,
      close_quality: params.close_quality,
      ev_threshold_bucket: evBucket,
    };
  }

  /**
   * Aggregate CLV metrics across a set of records.
   */
  public static aggregateCLV(records: ClvRecord[]): ClvAggregation {
    const valid = records.filter((r) => r.clv_ratio !== null);
    if (valid.length === 0) {
      return {
        sample_size: 0,
        mean_clv: null,
        median_clv: null,
        positive_clv_pct: null,
        verified_close_pct: 0,
        proxy_close_pct: 0,
      };
    }

    const ratios = valid.map((r) => r.clv_ratio!).sort((a, b) => a - b);
    const sum = ratios.reduce((s, v) => s + v, 0);
    const mean = sum / ratios.length;
    const median = ratios.length % 2 === 0
      ? (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2
      : ratios[Math.floor(ratios.length / 2)];

    const positiveCount = valid.filter((r) => r.clv_direction === 'BEAT_LINE').length;
    const verifiedCount = valid.filter((r) => r.close_quality === 'VERIFIED_CLOSE').length;
    const proxyCount = valid.filter((r) => r.close_quality === 'PROXY_CLOSE').length;

    return {
      sample_size: valid.length,
      mean_clv: Number(mean.toFixed(4)),
      median_clv: Number(median.toFixed(4)),
      positive_clv_pct: Number(((positiveCount / valid.length) * 100).toFixed(1)),
      verified_close_pct: Number(((verifiedCount / valid.length) * 100).toFixed(1)),
      proxy_close_pct: Number(((proxyCount / valid.length) * 100).toFixed(1)),
    };
  }

  /**
   * Multi-dimensional CLV aggregation breakdown.
   */
  public static multidimensionalBreakdown(records: ClvRecord[]): {
    overall: ClvAggregation;
    by_market: Record<string, ClvAggregation>;
    by_bookmaker: Record<string, ClvAggregation>;
    by_league: Record<string, ClvAggregation>;
    by_ev_bucket: Record<string, ClvAggregation>;
  } {
    const groupBy = (keyFn: (r: ClvRecord) => string) => {
      const groups: Record<string, ClvRecord[]> = {};
      for (const r of records) {
        const k = keyFn(r);
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
      }
      const aggregated: Record<string, ClvAggregation> = {};
      for (const k of Object.keys(groups)) {
        aggregated[k] = this.aggregateCLV(groups[k]);
      }
      return aggregated;
    };

    return {
      overall: this.aggregateCLV(records),
      by_market: groupBy((r) => r.market),
      by_bookmaker: groupBy((r) => r.bookmaker),
      by_league: groupBy((r) => r.league),
      by_ev_bucket: groupBy((r) => r.ev_threshold_bucket || 'All'),
    };
  }
}
