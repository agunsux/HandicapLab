/**
 * HANDICAP_LAB — Phase 16: Diagnostic Market Validation Matrix
 * =============================================================
 * Categorizes and isolates every prediction snapshot into 5 mandatory diagnostic states:
 * 1. Good prediction + bad price (Accurate P, but negative EV / market is too sharp)
 * 2. Good prediction + good price (Accurate P, positive EV, positive CLV, positive ROI)
 * 3. Bad prediction + apparent value (Inaccurate P creating phantom edge; negative CLV & loss)
 * 4. Positive EV + negative CLV (Model liked it, but market moved against the pick before kickoff)
 * 5. Positive CLV + temporary negative ROI (Genuine sharp value / line moved in favor, but match result variance caused loss)
 */

export type DiagnosticClass =
  | 'GOOD_PREDICTION_BAD_PRICE'
  | 'GOOD_PREDICTION_GOOD_PRICE'
  | 'BAD_PREDICTION_APPARENT_VALUE'
  | 'POSITIVE_EV_NEGATIVE_CLV'
  | 'POSITIVE_CLV_NEGATIVE_ROI';

export interface DiagnosticEvaluation {
  match_id: string;
  fixture: string;
  market: string;
  selection: string;
  p_model: number;
  p_market: number;
  ev: number;
  clv: number | null;
  outcome: string;
  profit: number;
  diagnostic_class: DiagnosticClass;
  explanation: string;
}

export class DiagnosticMatrix {
  public static classifyPrediction(params: {
    match_id: string;
    fixture: string;
    market: string;
    selection: string;
    p_model: number;
    entry_odds: number;
    closing_odds: number | null;
    outcome: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';
    profit: number;
    is_prediction_accurate: boolean; // e.g., model P > 0.5 and won, or calibrated brier < baseline
  }): DiagnosticEvaluation {
    const pMarket = 1.0 / params.entry_odds;
    const ev = params.p_model * params.entry_odds - 1.0;
    const clv = params.closing_odds && params.closing_odds > 1.0
      ? (params.entry_odds / params.closing_odds) - 1.0
      : null;
    const won = params.outcome === 'WIN' || params.outcome === 'HALF_WIN';

    let diagnosticClass: DiagnosticClass;
    let explanation: string;

    if (clv !== null && clv > 0.005 && !won) {
      // Line moved heavily in our favor, but result lost to variance
      diagnosticClass = 'POSITIVE_CLV_NEGATIVE_ROI';
      explanation = 'Sharp edge confirmed (beat closing line by >0.5%), but match result lost to variance.';
    } else if (ev > 0.02 && clv !== null && clv < -0.01) {
      // Model thought positive EV, but closing market drifted longer
      diagnosticClass = 'POSITIVE_EV_NEGATIVE_CLV';
      explanation = 'Model identified apparent positive EV, but market moved against the selection before kickoff.';
    } else if (ev > 0.01 && (clv === null || clv >= 0) && won) {
      // Good prediction and good entry price
      diagnosticClass = 'GOOD_PREDICTION_GOOD_PRICE';
      explanation = 'Edge validated: Positive EV, favorable/neutral CLV, and successful outcome settlement.';
    } else if (!params.is_prediction_accurate && ev > 0.03 && !won) {
      // Model error: mispriced probability creating false value
      diagnosticClass = 'BAD_PREDICTION_APPARENT_VALUE';
      explanation = 'Phantom edge: Flawed probability calculation suggested value where market was accurate.';
    } else {
      // Accurate prediction but bad price
      diagnosticClass = 'GOOD_PREDICTION_BAD_PRICE';
      explanation = 'Accurate probability estimate, but bookmaker price did not offer sufficient expected value.';
    }

    return {
      match_id: params.match_id,
      fixture: params.fixture,
      market: params.market,
      selection: params.selection,
      p_model: Number(params.p_model.toFixed(4)),
      p_market: Number(pMarket.toFixed(4)),
      ev: Number(ev.toFixed(4)),
      clv: clv !== null ? Number(clv.toFixed(4)) : null,
      outcome: params.outcome,
      profit: Number(params.profit.toFixed(2)),
      diagnostic_class: diagnosticClass,
      explanation,
    };
  }

  public static summarizeDiagnostics(evaluations: DiagnosticEvaluation[]): Record<DiagnosticClass, {
    count: number;
    percentage: string;
    avg_ev: number;
    avg_clv: number;
    total_profit: number;
  }> {
    const total = evaluations.length || 1;
    const summary: Record<DiagnosticClass, any> = {
      GOOD_PREDICTION_GOOD_PRICE: { count: 0, evSum: 0, clvSum: 0, profitSum: 0 },
      POSITIVE_CLV_NEGATIVE_ROI: { count: 0, evSum: 0, clvSum: 0, profitSum: 0 },
      POSITIVE_EV_NEGATIVE_CLV: { count: 0, evSum: 0, clvSum: 0, profitSum: 0 },
      GOOD_PREDICTION_BAD_PRICE: { count: 0, evSum: 0, clvSum: 0, profitSum: 0 },
      BAD_PREDICTION_APPARENT_VALUE: { count: 0, evSum: 0, clvSum: 0, profitSum: 0 },
    };

    for (const e of evaluations) {
      const s = summary[e.diagnostic_class];
      s.count++;
      s.evSum += e.ev;
      s.clvSum += e.clv || 0;
      s.profitSum += e.profit;
    }

    const result: any = {};
    for (const [key, s] of Object.entries(summary)) {
      result[key] = {
        count: s.count,
        percentage: `${((s.count / total) * 100).toFixed(1)}%`,
        avg_ev: s.count > 0 ? Number((s.evSum / s.count).toFixed(4)) : 0,
        avg_clv: s.count > 0 ? Number((s.clvSum / s.count).toFixed(4)) : 0,
        total_profit: Number(s.profitSum.toFixed(2)),
      };
    }

    return result;
  }
}
