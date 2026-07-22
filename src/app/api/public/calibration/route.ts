import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { calculateQuantitativeMetrics } from '@/lib/validation/metricsCalculator';

export const revalidate = 0;

export async function GET() {
  try {
    const { data } = await supabase
      .from('prediction_ledger')
      .select('*')
      .order('published_at', { ascending: false });

    const metrics = calculateQuantitativeMetrics(data || []);

    return NextResponse.json({
      status: 'success',
      sample_size_n: metrics.settledCount,
      ece_score: metrics.eceScore,
      calibration_status: metrics.calibrationStatus,
      timestamp_utc: metrics.lastUpdatedUtc,
      bins: metrics.calibrationBins
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=60'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
