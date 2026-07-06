// HandicapLab API - Get Upcoming Shadow Predictions
// Location: src/app/api/predictions/upcoming/route.ts

import { NextResponse } from 'next/server';
import { PredictionLedgerRepository } from '../../../../lib/data/predictionLedgerRepository';

export async function GET() {
  try {
    const all = await PredictionLedgerRepository.getAllPredictions();
    const upcoming = all.filter(
      (p) => !p.prediction_settlements_v3 || p.prediction_settlements_v3.length === 0
    );

    return NextResponse.json({
      count: upcoming.length,
      predictions: upcoming.map((p) => ({
        predictionHash: p.prediction_hash,
        matchId: p.match_id,
        marketType: p.market_type,
        selection: p.selection,
        marketOdds: p.market_odds,
        probability: p.calibrated_probability,
        stake: p.risk_adjusted_stake,
        recommendation: p.explainability_json?.recommendation || 'NO BET',
        reasonCodes: p.explainability_json?.reasonCodes || [],
        timestamp: p.prediction_timestamp
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
