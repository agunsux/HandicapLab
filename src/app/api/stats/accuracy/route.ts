import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET() {
  try {
    // Fetch all prediction outcomes to calculate metrics in Node.js
    const { data: results, error: queryError } = await supabase
      .from('prediction_results')
      .select('hit_1x2, hit_ah, hit_ou, profit_1x2, profit_ah, profit_ou');

    if (queryError) {
      console.error('❌ Error querying prediction_results:', queryError.message);
      return NextResponse.json({
        status: 'Database Error',
        reliability_flag: false,
        sample_size: 0,
        hit_rate: 0,
        roi_placeholder: 0,
        confidence_interval: 'N/A',
        accuracy1x2: 0,
        accuracyAh: 0,
        accuracyOu: 0,
      });
    }

    const total = results?.length || 0;
    const totalBets = total * 3;

    if (total === 0) {
      return NextResponse.json({
        status: 'Insufficient sample size',
        reliability_flag: false,
        sample_size: 0,
        hit_rate: 0,
        roi_placeholder: 0,
        confidence_interval: 'N/A',
        accuracy1x2: 0,
        accuracyAh: 0,
        accuracyOu: 0,
      });
    }

    const hits1x2 = results.filter(r => r.hit_1x2).length;
    const hitsAh = results.filter(r => r.hit_ah).length;
    const hitsOu = results.filter(r => r.hit_ou).length;
    const totalHits = hits1x2 + hitsAh + hitsOu;

    const hitRate = Number(((totalHits / totalBets) * 100).toFixed(2));
    const accuracy1x2 = Number(((hits1x2 / total) * 100).toFixed(2));
    const accuracyAh = Number(((hitsAh / total) * 100).toFixed(2));
    const accuracyOu = Number(((hitsOu / total) * 100).toFixed(2));

    // Calculate Net ROI across all placed bets (1 unit per market)
    const totalProfit = results.reduce((acc, r) => {
      return acc + Number(r.profit_1x2 || 0) + Number(r.profit_ah || 0) + Number(r.profit_ou || 0);
    }, 0);
    const roi = Number(((totalProfit / totalBets) * 100).toFixed(2));

    // Calculate 95% Confidence Interval for overall hit rate (z = 1.96)
    const p = totalHits / totalBets;
    const standardError = Math.sqrt((p * (1 - p)) / totalBets);
    const marginOfError = 1.96 * standardError;
    const ciLower = Math.max(0, p - marginOfError) * 100;
    const ciUpper = Math.min(1, p + marginOfError) * 100;
    const confidenceInterval = `[${ciLower.toFixed(1)}%, ${ciUpper.toFixed(1)}%]`;

    const reliabilityFlag = total >= 100;
    const statusMessage = reliabilityFlag ? 'Based on tracked predictions' : 'Insufficient sample size';

    return NextResponse.json({
      status: statusMessage,
      reliability_flag: reliabilityFlag,
      sample_size: total,
      hit_rate: reliabilityFlag ? hitRate : 0,
      roi_placeholder: reliabilityFlag ? roi : 0,
      confidence_interval: reliabilityFlag ? confidenceInterval : 'N/A',
      accuracy1x2: reliabilityFlag ? accuracy1x2 : 0,
      accuracyAh: reliabilityFlag ? accuracyAh : 0,
      accuracyOu: reliabilityFlag ? accuracyOu : 0,
      // Expose raw calculation data in private fields for diagnostic check scripts
      _diagnostic: {
        hit_rate: hitRate,
        roi,
        confidence_interval: confidenceInterval,
        accuracy1x2,
        accuracyAh,
        accuracyOu
      }
    });
  } catch (err: any) {
    console.error('❌ Internal server error in accuracy API:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
