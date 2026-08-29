import { NextResponse } from 'next/server';
import { DailyAhShadowPipeline } from '@/lib/pipeline/dailyAhShadowPipeline';

export const revalidate = 300;

export async function GET() {
  try {
    let records: any[] = [];
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.from('public_predictions').select('*');
        if (!error && data && data.length > 0) {
          records = data;
        }
      } catch (err) {
        console.warn('[Track Record API] Supabase fetch fallback to local ledger:', err);
      }
    }

    if (records.length === 0) {
      const localLedger = DailyAhShadowPipeline.loadLedger();
      records = localLedger.map((r) => ({
        id: r.id,
        settlement_status: r.settlementStatus,
        actual_outcome: r.actualOutcome,
        profit_loss: r.profitLoss,
        clv: r.clv,
        kickoff_at: r.kickoffAt,
      }));
    }

    const settled = records.filter((r) => r.settlement_status === 'SETTLED');
    const wins = settled.filter((r) => (r.profit_loss || 0) > 0).length;
    const hitRate = settled.length > 0 ? Number(((wins / settled.length) * 100).toFixed(2)) : 0;

    const totalProfit = settled.reduce((sum, r) => sum + (r.profit_loss || 0), 0);
    const roi = settled.length > 0 ? Number(((totalProfit / settled.length) * 100).toFixed(2)) : 0;

    const clvValues = settled
      .map((r) => r.clv)
      .filter((c): c is number => c !== undefined && c !== null && !isNaN(c));
    const clvMean =
      clvValues.length > 0
        ? Number((clvValues.reduce((a, b) => a + b, 0) / clvValues.length).toFixed(4))
        : 0;

    const clvVar =
      clvValues.length > 1
        ? clvValues.reduce((s, x) => s + Math.pow(x - clvMean, 2), 0) / (clvValues.length - 1)
        : 0;
    const clvSe = Math.sqrt(clvVar / Math.max(1, clvValues.length));
    const clvZ = clvSe > 0 ? Number((clvMean / clvSe).toFixed(3)) : 0;

    const targetGate = 175;
    const gateProgress = Number(((settled.length / targetGate) * 100).toFixed(1));

    return NextResponse.json(
      {
        status: 'SUCCESS',
        total_predictions: records.length,
        settled_count: settled.length,
        pending_count: records.length - settled.length,
        hit_rate: hitRate,
        roi: roi,
        clv_mean: clvMean,
        clv_z: clvZ,
        target_gate: targetGate,
        gate_progress_pct: Math.min(100, gateProgress),
        historical_backtest_context: {
          champion_model: 'AH-dixoncoles-v1.0.0',
          backtest_roi: -2.30,
          backtest_clv_mean: -0.0311,
          backtest_pvalue: 0.555,
          validation_state: 'RESEARCH_ONLY',
        },
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 });
  }
}
