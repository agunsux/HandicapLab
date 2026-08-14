/**
 * HANDICAP_LAB — Expected Value (EV) & Multi-Threshold Engine (Phases 10 & 11)
 * ==============================================================================
 * Independent EV calculation and multi-threshold reporting:
 * - EV = P(model) * Odds(entry) - 1
 * - Implied Probability = 1 / Odds(entry)
 * - Thresholds evaluated: >=1%, >=3%, >=5%, >=7%, >=10%
 * - Comprehensive reporting: opportunities, hit rate, avg/median EV, ROI, P/L, CLV, drawdown, 95% CI
 */

import { winRateWithCI, roiWithCI } from '../../historical/model/metrics';

export interface ValueBetOpportunity {
  match_id: string;
  fixture: string;
  market: 'ML' | 'OU25' | 'BTTS' | 'AH';
  selection: string;
  line: number | null;
  bookmaker: string;
  model_probability: number;
  market_implied_probability: number;
  entry_odds: number;
  closing_odds: number | null;
  ev: number;
  edge_pct: number;
  clv: number | null;
  prediction_timestamp: string;
  entry_timestamp: string;
  outcome?: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';
  profit?: number;
}

export interface ThresholdReportEntry {
  threshold: string;
  min_ev: number;
  opportunities: number;
  wins: number;
  losses: number;
  pushes: number;
  hit_rate: number | null;
  average_ev: number | null;
  median_ev: number | null;
  total_profit: number;
  roi: number | null;
  roi_ci95: [number, number] | null;
  average_clv: number | null;
  max_drawdown: number;
}

export class ValueEngine {
  /**
   * Phase 10: Calculate expected value for decimal odds.
   */
  public static calculateEV(modelProbability: number, entryOdds: number): {
    ev: number;
    edge_pct: number;
    implied_probability: number;
  } {
    if (modelProbability <= 0 || entryOdds <= 1.0) {
      return { ev: -1.0, edge_pct: -100.0, implied_probability: 1.0 };
    }

    const ev = modelProbability * entryOdds - 1.0;
    const implied = 1.0 / entryOdds;
    const edgePct = (modelProbability - implied) * 100.0;

    return {
      ev: Number(ev.toFixed(4)),
      edge_pct: Number(edgePct.toFixed(2)),
      implied_probability: Number(implied.toFixed(4)),
    };
  }

  /**
   * Phase 11: Multi-Threshold Value Bet Filtering & Analysis
   */
  public static evaluateThresholds(opportunities: ValueBetOpportunity[]): ThresholdReportEntry[] {
    const thresholds = [
      { label: 'EV ≥ 1%', min_ev: 0.01 },
      { label: 'EV ≥ 3%', min_ev: 0.03 },
      { label: 'EV ≥ 5%', min_ev: 0.05 },
      { label: 'EV ≥ 7%', min_ev: 0.07 },
      { label: 'EV ≥ 10%', min_ev: 0.10 },
    ];

    return thresholds.map((t) => {
      const subset = opportunities.filter((o) => o.ev >= t.min_ev);
      const settled = subset.filter((o) => o.profit !== undefined && o.profit !== null);

      let wins = 0;
      let losses = 0;
      let pushes = 0;
      let totalProfit = 0;
      const profits: number[] = [];
      const evs: number[] = [];
      const clvs: number[] = [];

      // Drawdown tracker
      let peak = 0;
      let runningPnl = 0;
      let maxDrawdown = 0;

      for (const bet of settled) {
        const p = bet.profit!;
        profits.push(p);
        evs.push(bet.ev);
        if (bet.clv !== null && bet.clv !== undefined) clvs.push(bet.clv);

        if (bet.outcome === 'WIN' || bet.outcome === 'HALF_WIN') wins++;
        else if (bet.outcome === 'PUSH') pushes++;
        else losses++;

        totalProfit += p;
        runningPnl += p;
        if (runningPnl > peak) peak = runningPnl;
        const dd = peak - runningPnl;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      const wr = winRateWithCI(wins, settled.length);
      const roi = roiWithCI(profits, profits.map(() => 1));

      // Calculate median EV
      evs.sort((a, b) => a - b);
      const medianEv = evs.length > 0 ? (evs.length % 2 === 0 ? (evs[evs.length / 2 - 1] + evs[evs.length / 2]) / 2 : evs[Math.floor(evs.length / 2)]) : null;
      const avgEv = evs.length > 0 ? evs.reduce((s, v) => s + v, 0) / evs.length : null;
      const avgClv = clvs.length > 0 ? clvs.reduce((s, v) => s + v, 0) / clvs.length : null;

      return {
        threshold: t.label,
        min_ev: t.min_ev,
        opportunities: subset.length,
        wins,
        losses,
        pushes,
        hit_rate: wr ? Number(wr.mean.toFixed(4)) : null,
        average_ev: avgEv !== null ? Number(avgEv.toFixed(4)) : null,
        median_ev: medianEv !== null ? Number(medianEv.toFixed(4)) : null,
        total_profit: Number(totalProfit.toFixed(2)),
        roi: roi ? Number(roi.roi.toFixed(4)) : null,
        roi_ci95: roi ? [Number(roi.ci95_low.toFixed(4)), Number(roi.ci95_high.toFixed(4))] : null,
        average_clv: avgClv !== null ? Number(avgClv.toFixed(4)) : null,
        max_drawdown: Number(maxDrawdown.toFixed(2)),
      };
    });
  }
}
