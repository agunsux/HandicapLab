import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('prediction_ledger')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      count: data?.length || 0,
      timestamp_utc: new Date().toISOString(),
      predictions: (data || []).map(p => ({
        doi: p.doi_id || `HLP-2026-EPL-${p.id.substring(0, 6).toUpperCase()}`,
        published_at: p.published_at,
        market: p.market,
        selection: p.selection,
        odds: p.odds_at_prediction,
        confidence: p.confidence,
        result_status: p.result_status,
        settled_at: p.settled_at,
        roi: p.roi,
        verified: p.verified
      }))
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
