// Get Current Market Edges API Route
// Location: src/app/api/edges/route.ts

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const minEV = parseFloat(searchParams.get('minEV') || '0.0');
    const bookmaker = searchParams.get('bookmaker');

    let query = supabase
      .from('market_edges')
      .select(`
        *,
        matches (
          home_team,
          away_team,
          league,
          kickoff
        )
      `)
      .gte('expected_value', minEV);

    if (matchId) {
      query = query.eq('match_id', matchId);
    }
    if (bookmaker) {
      query = query.eq('bookmaker', bookmaker);
    }

    // Order by EV descending
    const { data: edges, error } = await query.order('expected_value', { ascending: false });

    if (error) throw error;

    return ApiHelper.response(true, edges || []);
  } catch (error: any) {
    console.error('[Get Edges API] Error:', error);
    return ApiHelper.response(false, null, error.message, 500);
  }
}
