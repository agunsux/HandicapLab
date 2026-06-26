import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET() {
  try {
    // 1. Fetch all settled signals from the database
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .not('settled_at', 'is', null)
      .order('settled_at', { ascending: false });

    if (error) {
      console.error('[Performance API] Error querying signals:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const settledCount = signals?.length || 0;

    let profitUnits = 0;
    let winCount = 0;
    let binaryBrierSum = 0;
    let binaryCount = 0;
    let clvSum = 0;
    let clvCount = 0;

    (signals || []).forEach((sig) => {
      const odds = Number(sig.odds || 1.0);
      const prob = Number(sig.probability || 0.5);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;
      let outcomeValue = 0;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        outcomeValue = 1.0;
        winCount++;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        outcomeValue = 1.0;
        winCount++;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
        outcomeValue = 0.5;
      } else if (status === 'half_loss') {
        profit = -0.5;
        outcomeValue = 0.0;
      } else {
        profit = -1.0;
        outcomeValue = 0.0;
      }

      profitUnits += profit;

      // Brier score only for binary markets (asian_handicap and over_under)
      const market = (sig.market || '').toLowerCase();
      if (market === 'asian_handicap' || market === 'over_under') {
        binaryBrierSum += Math.pow(prob - outcomeValue, 2);
        binaryCount++;
      }

      // CLV Percentage aggregation
      if (sig.clv_percentage !== null && sig.clv_percentage !== undefined) {
        clvSum += Number(sig.clv_percentage);
        clvCount++;
      }
    });

    const insufficientSample = settledCount < 50;
    const averageClv = (insufficientSample || clvCount === 0) ? null : Number((clvSum / clvCount).toFixed(2));

    // 2. Safeguard: if less than 30 settled signals, return calibration flag
    if (settledCount < 30) {
      return NextResponse.json({
        success: true,
        calibrationInProgress: true,
        insufficient_sample: insufficientSample,
        status: insufficientSample ? 'insufficient_sample' : 'sufficient',
        requiredForClv: 50,
        settledCount,
        averageClv,
        signals: signals || []
      });
    }

    // ROI calculation: profit_units / settled_signals_count * 100
    const roi = (profitUnits / settledCount) * 100;
    const winRate = (winCount / settledCount) * 100;
    const brierScore = binaryCount > 0 ? (binaryBrierSum / binaryCount) : 0.0;
    const calibrationScore = Math.round((1.0 - brierScore) * 100);

    return NextResponse.json({
      success: true,
      calibrationInProgress: false,
      insufficient_sample: insufficientSample,
      status: insufficientSample ? 'insufficient_sample' : 'sufficient',
      requiredForClv: 50,
      settledCount,
      roi: Number(roi.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
      brierScore: Number(brierScore.toFixed(4)),
      calibrationScore,
      profitUnits: Number(profitUnits.toFixed(4)),
      averageClv,
      signals
    });
  } catch (error: any) {
    console.error('[Performance API] Fatal Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
