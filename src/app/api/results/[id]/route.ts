// HandicapLab API - Get Settled Prediction Results
// Location: src/app/api/results/[id]/route.ts

import { NextResponse } from 'next/server';
import { PredictionLedgerRepository } from '../../../../lib/data/predictionLedgerRepository';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const records = await PredictionLedgerRepository.getPredictionsByMatchId(matchId);

    if (!records || records.length === 0) {
      return NextResponse.json({ error: `Settled records for match ID ${matchId} not found.` }, { status: 404 });
    }

    return NextResponse.json({
      matchId,
      predictions: records.map((r) => {
        const settlement = r.prediction_settlements_v3?.[0] || {};
        return {
          predictionHash: r.prediction_hash,
          marketType: r.market_type,
          selection: r.selection,
          marketOdds: r.market_odds,
          stake: r.risk_adjusted_stake,
          status: settlement.status || 'PENDING',
          profitLoss: settlement.profit_loss || null,
          closingOdds: settlement.closing_odds || null,
          actualClv: settlement.actual_clv || null,
          brierContribution: settlement.brier_contribution || null,
          loglossContribution: settlement.logloss_contribution || null,
          settledAt: settlement.settled_at || null
        };
      })
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
