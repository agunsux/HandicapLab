import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET() {
  try {
    // 1. Check settled count strictly from prediction_ledger_v3 where actual_outcome IS NOT NULL
    const { count: settledCount } = await supabase
      .from('prediction_ledger_v3')
      .select('*', { count: 'exact', head: true })
      .not('actual_outcome', 'is', null);

    const actualSettledCount = settledCount || 0;

    // Guardrail #1: If settled_count < 50, return building: true
    if (actualSettledCount < 50) {
      // Also fetch per-market counts of active upcoming predictions for dashboard card rendering
      const { data: counts } = await supabase
        .from('prediction_ledger_v3')
        .select('market_type');

      const marketCounts: Record<string, number> = { AH: 0, OU: 0, ML: 0, BTTS: 0 };
      (counts || []).forEach((row: { market_type: string }) => {
        if (marketCounts[row.market_type] !== undefined) {
          marketCounts[row.market_type] += 1;
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          building: true,
          settled_count: actualSettledCount,
          required_settled_count: 50,
          marketCounts,
        },
      });
    }

    // If >= 50 settled, compute actual performance from performance_ledger
    const { data: perfRows } = await supabase
      .from('performance_ledger')
      .select('*');

    let totalBrier = 0;
    let totalClv = 0;
    let totalEv = 0;
    const n = perfRows?.length || 1;

    (perfRows || []).forEach((r: any) => {
      totalBrier += r.brier_score || 0;
      totalClv += r.clv || 0;
      totalEv += r.expected_value || 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        building: false,
        settled_count: actualSettledCount,
        brier_score: Number((totalBrier / n).toFixed(4)),
        clv: Number((totalClv / n).toFixed(4)),
        portfolio_ev: Number((totalEv / n).toFixed(4)),
      },
    });
  } catch (error: any) {
    console.error('Stats Dashboard API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Error',
    }, { status: 500 });
  }
}
