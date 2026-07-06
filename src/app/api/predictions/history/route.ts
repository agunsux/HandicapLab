// HandicapLab API - Get Settled Prediction History
// Location: src/app/api/predictions/history/route.ts

import { NextResponse } from 'next/server';
import { PredictionLedgerRepository } from '../../../../lib/data/predictionLedgerRepository';

export async function GET() {
  try {
    const all = await PredictionLedgerRepository.getAllPredictions();
    const settled = all.filter(
      (p) => p.prediction_settlements_v3 && p.prediction_settlements_v3.length > 0
    );

    return NextResponse.json({
      count: settled.length,
      history: settled.map((p) => {
        const settlement = p.prediction_settlements_v3[0];
        return {
          predictionHash: p.prediction_hash,
          matchId: p.match_id,
          marketType: p.market_type,
          selection: p.selection,
          marketOdds: p.market_odds,
          probability: p.calibrated_probability,
          stake: p.risk_adjusted_stake,
          status: settlement.status,
          profitLoss: settlement.profit_loss,
          closingOdds: settlement.closing_odds,
          actualClv: settlement.actual_clv,
          brierContribution: settlement.brier_contribution,
          loglossContribution: settlement.logloss_contribution,
          recommendation: p.explainability_json?.recommendation || 'NO BET',
          timestamp: p.prediction_timestamp
        };
      })
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
