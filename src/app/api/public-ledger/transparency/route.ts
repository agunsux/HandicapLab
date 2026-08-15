import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(req: NextRequest) {
  try {
    const { data: audits, error } = await supabase
      .from('prediction_audits')
      .select('id, settlement, profit, roi, clv, created_at');

    if (error) {
      console.warn('[Transparency Route] Error querying audits:', error.message);
    }

    const records = audits || [];
    const totalPredictions = records.length;
    const settledRecords = records.filter(r => r.settlement && r.settlement !== 'PENDING');
    const settledPredictions = settledRecords.length;
    const pendingPredictions = totalPredictions - settledPredictions;

    const wins = settledRecords.filter(r => r.settlement === 'WIN' || r.settlement === 'WON' || r.settlement === 'HALF_WIN').length;
    const hitRatePct = settledPredictions > 0 ? Number(((wins / settledPredictions) * 100).toFixed(1)) : 0;

    const totalProfit = settledRecords.reduce((acc, r) => acc + (Number(r.profit) || 0), 0);
    const roiPct = settledPredictions > 0 ? Number(((totalProfit / settledPredictions) * 100).toFixed(2)) : 0;

    const clvRecords = settledRecords.filter(r => r.clv !== null && r.clv !== undefined);
    const avgClvPct = clvRecords.length > 0
      ? Number((clvRecords.reduce((acc, r) => acc + Number(r.clv), 0) / clvRecords.length).toFixed(2))
      : 0;

    const positiveClvCount = clvRecords.filter(r => Number(r.clv) > 0).length;
    const positiveClvPct = clvRecords.length > 0
      ? Number(((positiveClvCount / clvRecords.length) * 100).toFixed(1))
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalPredictions,
        settledPredictions,
        pendingPredictions,
        hitRatePct,
        roiPct,
        yieldPct: roiPct,
        avgClvPct,
        positiveClvPct,
        brierScore: null,
        ecePct: null,
        currentModelVersion: 'v1.40.0',
        lastAuditAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
