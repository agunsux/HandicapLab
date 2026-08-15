import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ConfidenceMovementEngine } from '../../../../lib/value-intelligence/confidence-movement';

export async function GET(req: NextRequest) {
  try {
    const { data: audits, error } = await supabase
      .from('prediction_audits')
      .select('*')
      .not('settled_at', 'is', null);

    if (error) {
      console.warn('[Research Console API] Error fetching audits:', error.message);
    }

    const records = audits || [];
    const confidenceBuckets = ConfidenceMovementEngine.getConfidenceBuckets(records);

    // EV Buckets computation
    const evRanges = [
      { evBucket: '0% - 2%', min: 0.0, max: 0.02 },
      { evBucket: '2% - 5%', min: 0.02, max: 0.05 },
      { evBucket: '5% - 8%', min: 0.05, max: 0.08 },
      { evBucket: '8% - 12%', min: 0.08, max: 0.12 },
      { evBucket: '12%+', min: 0.12, max: Infinity },
    ];

    const evMatrix = evRanges.map(r => {
      const matching = records.filter(a => {
        const ev = Number(a.expected_value || a.ev || 0);
        return ev >= r.min && ev < r.max;
      });

      const count = matching.length;
      if (count === 0) {
        return { evBucket: r.evBucket, bets: 0, roi: 0, clv: 0, hitRate: 0 };
      }

      const wins = matching.filter(a => a.settlement === 'WIN' || a.settlement === 'WON').length;
      const profit = matching.reduce((acc, a) => acc + (Number(a.profit) || 0), 0);
      const clvSum = matching.reduce((acc, a) => acc + (Number(a.clv) || 0), 0);

      return {
        evBucket: r.evBucket,
        bets: count,
        roi: Number(((profit / count) * 100).toFixed(2)),
        clv: Number((clvSum / count).toFixed(2)),
        hitRate: Number(((wins / count) * 100).toFixed(2)),
      };
    });

    const stakingComparison: any[] = [];

    return NextResponse.json({
      success: true,
      data: {
        confidenceBuckets,
        evMatrix,
        stakingComparison,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
