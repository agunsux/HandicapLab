import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function GET(request: NextRequest) {
  try {
    const { data: results, error } = await supabase
      .from('matches')
      .select('id, home_team, away_team, league, kickoff, home_goals, away_goals, status')
      .eq('status', 'finished')
      .order('kickoff', { ascending: false })
      .limit(50);

    if (error) throw error;

    return ApiHelper.response(true, {
      count: results?.length ?? 0,
      results: results ?? []
    });
  } catch (error: any) {
    console.error('[Results API] Error:', error);
    return ApiHelper.response(false, null, error, 500);
  }
}
