import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: Request) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data: predictions, error } = await supabase
      .from('shadow_predictions')
      .select('*')
      .gte('created_at', sevenDaysAgo);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const total = predictions ? predictions.length : 0;
    const settled = (predictions || []).filter(p => p.result_status !== 'pending');

    let won = 0;
    let stakes = 0;
    let payout = 0;
    let clvSum = 0;

    const competitionStats: Record<string, { stakes: number; payout: number }> = {};
    const marketStats: Record<string, { stakes: number; payout: number }> = {};

    for (const p of settled) {
      clvSum += Number(p.clv || 0);

      const comp = p.competition;
      const mkt = p.market_type;

      if (!competitionStats[comp]) competitionStats[comp] = { stakes: 0, payout: 0 };
      if (!marketStats[mkt]) marketStats[mkt] = { stakes: 0, payout: 0 };

      if (p.result_status === 'won') {
        won++;
        stakes += 1.0;
        payout += Number(p.odds_at_prediction);

        competitionStats[comp].stakes += 1.0;
        competitionStats[comp].payout += Number(p.odds_at_prediction);

        marketStats[mkt].stakes += 1.0;
        marketStats[mkt].payout += Number(p.odds_at_prediction);
      } else if (p.result_status === 'lost') {
        stakes += 1.0;
        competitionStats[comp].stakes += 1.0;
        marketStats[mkt].stakes += 1.0;
      } else {
        stakes += 1.0;
        payout += 1.0;

        competitionStats[comp].stakes += 1.0;
        competitionStats[comp].payout += 1.0;

        marketStats[mkt].stakes += 1.0;
        marketStats[mkt].payout += 1.0;
      }
    }

    const settledCount = settled.length;
    const roi = stakes > 0 ? ((payout - stakes) / stakes) * 100 : 0;
    const avgClv = settledCount > 0 ? clvSum / settledCount : 0;

    // Determine best/worst competition by ROI
    let bestComp = 'None';
    let bestCompRoi = -Infinity;
    let worstComp = 'None';
    let worstCompRoi = Infinity;

    for (const comp of Object.keys(competitionStats)) {
      const stats = competitionStats[comp];
      const compRoi = stats.stakes > 0 ? ((stats.payout - stats.stakes) / stats.stakes) * 100 : 0;
      if (compRoi > bestCompRoi) {
        bestCompRoi = compRoi;
        bestComp = comp;
      }
      if (compRoi < worstCompRoi) {
        worstCompRoi = compRoi;
        worstComp = comp;
      }
    }

    // Determine best market by ROI
    let bestMkt = 'None';
    let bestMktRoi = -Infinity;

    for (const mkt of Object.keys(marketStats)) {
      const stats = marketStats[mkt];
      const mktRoi = stats.stakes > 0 ? ((stats.payout - stats.stakes) / stats.stakes) * 100 : 0;
      if (mktRoi > bestMktRoi) {
        bestMktRoi = mktRoi;
        bestMkt = mkt === 'ML' ? 'Moneyline' : (mkt === 'AH' ? 'Asian Handicap' : 'Over Under');
      }
    }

    return NextResponse.json({
      success: true,
      signals_generated: total,
      settled_count: settledCount,
      roi: Number(roi.toFixed(2)),
      clv: Number(avgClv.toFixed(2)),
      best_competition: bestComp,
      worst_competition: worstComp,
      best_market: bestMkt
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
