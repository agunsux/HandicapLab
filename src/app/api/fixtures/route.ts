import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function GET(request: NextRequest) {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .in('status', ['upcoming', 'live'])
      .order('kickoff', { ascending: true })
      .limit(50);

    if (error) throw error;

    return ApiHelper.response(true, {
      count: matches?.length ?? 0,
      fixtures: matches ?? []
    });
  } catch (error: any) {
    console.error('[Fixtures API] Error:', error);
    return ApiHelper.response(false, null, error, 500);
  }
}
