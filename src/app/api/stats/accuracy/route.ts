import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET() {
  try {
    // Try executing the database RPC function first
    const { data, error } = await supabase.rpc('get_prediction_accuracy');

    if (error) {
      console.warn('⚠️ get_prediction_accuracy() RPC failed, running fallback query:', error.message);
      
      // Fallback: manually fetch outcomes and compute averages
      const { data: results, error: queryError } = await supabase
        .from('prediction_results')
        .select('hit_1x2, hit_ah, hit_ou');

      if (queryError) {
        console.error('❌ Manual fallback query failed:', queryError.message);
        return NextResponse.json({
          total: 0,
          accuracy1x2: 0,
          accuracyAh: 0,
          accuracyOu: 0
        });
      }

      if (!results || results.length === 0) {
        return NextResponse.json({
          total: 0,
          accuracy1x2: 0,
          accuracyAh: 0,
          accuracyOu: 0
        });
      }

      const total = results.length;
      const hits1x2 = results.filter(r => r.hit_1x2).length;
      const hitsAh = results.filter(r => r.hit_ah).length;
      const hitsOu = results.filter(r => r.hit_ou).length;

      return NextResponse.json({
        total,
        accuracy1x2: Number(((hits1x2 / total) * 100).toFixed(2)),
        accuracyAh: Number(((hitsAh / total) * 100).toFixed(2)),
        accuracyOu: Number(((hitsOu / total) * 100).toFixed(2))
      });
    }

    // Parse output from the RPC function (it returns standard JSON)
    const stats = typeof data === 'string' ? JSON.parse(data) : data;

    return NextResponse.json({
      total: stats?.total ?? 0,
      accuracy1x2: stats?.accuracy1x2 ?? 0,
      accuracyAh: stats?.accuracyAh ?? 0,
      accuracyOu: stats?.accuracyOu ?? 0
    });
  } catch (err: any) {
    console.error('❌ Error fetching accuracy stats:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
