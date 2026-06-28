import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: Request) {
  try {
    const { data: predictions, error } = await supabase
      .from('shadow_predictions')
      .select('*');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const total = predictions ? predictions.length : 0;
    const settled = (predictions || []).filter(p => p.result_status !== 'pending');
    const pending = (predictions || []).filter(p => p.result_status === 'pending');

    const settledCount = settled.length;
    let won = 0;
    let lost = 0;
    let voided = 0;
    let clvSum = 0;
    let stakes = 0;
    let payout = 0;
    let brierSum = 0;

    const marketBreakdowns: Record<string, { total: number; won: number; clv: number; stakes: number; payout: number }> = {
      AH: { total: 0, won: 0, clv: 0, stakes: 0, payout: 0 },
      OU: { total: 0, won: 0, clv: 0, stakes: 0, payout: 0 },
      ML: { total: 0, won: 0, clv: 0, stakes: 0, payout: 0 }
    };

    const confidenceBreakdowns = {
      '60-70': { total: 0, won: 0, clv: 0, stakes: 0, payout: 0 },
      '70-80': { total: 0, won: 0, clv: 0, stakes: 0, payout: 0 },
      '80+': { total: 0, won: 0, clv: 0, stakes: 0, payout: 0 }
    };

    for (const p of settled) {
      clvSum += Number(p.clv || 0);

      // Brier Score component
      const prob = Number(p.predicted_probability || 0.5);
      const actual = p.result_status === 'won' ? 1.0 : (p.result_status === 'lost' ? 0.0 : 0.5);
      brierSum += Math.pow(prob - actual, 2);

      const m = p.market_type;
      if (marketBreakdowns[m]) {
        marketBreakdowns[m].total++;
        marketBreakdowns[m].clv += Number(p.clv || 0);
      }

      // Determine confidence bucket
      let confKey: '60-70' | '70-80' | '80+' = '60-70';
      if (prob >= 0.80) {
        confKey = '80+';
      } else if (prob >= 0.70) {
        confKey = '70-80';
      }
      confidenceBreakdowns[confKey].total++;
      confidenceBreakdowns[confKey].clv += Number(p.clv || 0);

      if (p.result_status === 'won') {
        won++;
        stakes += 1.0;
        payout += Number(p.odds_at_prediction);
        if (marketBreakdowns[m]) {
          marketBreakdowns[m].won++;
          marketBreakdowns[m].stakes += 1.0;
          marketBreakdowns[m].payout += Number(p.odds_at_prediction);
        }
        confidenceBreakdowns[confKey].won++;
        confidenceBreakdowns[confKey].stakes += 1.0;
        confidenceBreakdowns[confKey].payout += Number(p.odds_at_prediction);
      } else if (p.result_status === 'lost') {
        lost++;
        stakes += 1.0;
        if (marketBreakdowns[m]) {
          marketBreakdowns[m].stakes += 1.0;
        }
        confidenceBreakdowns[confKey].stakes += 1.0;
      } else {
        voided++;
        stakes += 1.0;
        payout += 1.0;
        if (marketBreakdowns[m]) {
          marketBreakdowns[m].stakes += 1.0;
          marketBreakdowns[m].payout += 1.0;
        }
        confidenceBreakdowns[confKey].stakes += 1.0;
        confidenceBreakdowns[confKey].payout += 1.0;
      }
    }

    const winRate = settledCount > 0 ? (won / settledCount) * 100 : 0;
    const roi = stakes > 0 ? ((payout - stakes) / stakes) * 100 : 0;
    const avgClv = settledCount > 0 ? clvSum / settledCount : 0;
    const brierScore = settledCount > 0 ? brierSum / settledCount : 0;

    const markets = Object.keys(marketBreakdowns).map(k => {
      const b = marketBreakdowns[k];
      const mWinRate = b.total > 0 ? (b.won / b.total) * 100 : 0;
      const mRoi = b.stakes > 0 ? ((b.payout - b.stakes) / b.stakes) * 100 : 0;
      const mClv = b.total > 0 ? b.clv / b.total : 0;
      return {
        market: k === 'ML' ? 'Moneyline' : (k === 'AH' ? 'Asian Handicap' : 'Over Under'),
        total: b.total,
        win_rate: Number(mWinRate.toFixed(2)),
        roi: Number(mRoi.toFixed(2)),
        clv: Number(mClv.toFixed(2))
      };
    });

    const confidence = Object.keys(confidenceBreakdowns).map(k => {
      const b = confidenceBreakdowns[k as keyof typeof confidenceBreakdowns];
      const cWinRate = b.total > 0 ? (b.won / b.total) * 100 : 0;
      const cRoi = b.stakes > 0 ? ((b.payout - b.stakes) / b.stakes) * 100 : 0;
      const cClv = b.total > 0 ? b.clv / b.total : 0;
      return {
        bucket: k,
        total: b.total,
        win_rate: Number(cWinRate.toFixed(2)),
        roi: Number(cRoi.toFixed(2)),
        clv: Number(cClv.toFixed(2))
      };
    });

    return NextResponse.json({
      success: true,
      total_predictions: total,
      settled_count: settledCount,
      pending_count: pending.length,
      overall: {
        win_rate: Number(winRate.toFixed(2)),
        roi: Number(roi.toFixed(2)),
        clv: Number(avgClv.toFixed(2)),
        brier_score: Number(brierScore.toFixed(4))
      },
      markets,
      confidence
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
