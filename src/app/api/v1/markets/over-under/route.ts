import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { FREE_VISIBLE_SIGNALS } from '@/config/entitlements';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || 'all';

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    let userId: string | undefined;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const entitlements = await getUserEntitlements(userId);
    const isPro = entitlements.hasFullEdgeData;

    let query = supabase
      .from('daily_picks')
      .select('*')
      .in('market_type', ['OVER_UNDER', 'OU'])
      .order('edge_pct', { ascending: false });

    const now = new Date();
    if (dateParam === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      query = query.gte('kickoff_utc', startOfDay).lte('kickoff_utc', endOfDay);
    } else if (dateParam === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();
      query = query.gte('kickoff_utc', startOfDay).lte('kickoff_utc', endOfDay);
    } else {
      query = query.gt('kickoff_utc', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((row: any, index: number) => {
      const isLocked = !isPro && index >= FREE_VISIBLE_SIGNALS;
      const p = row.model_probability !== null && row.model_probability !== undefined ? Number(row.model_probability) : 0.5;
      const odds = row.market_odds !== null && row.market_odds !== undefined ? Number(row.market_odds) : null;
      const ev = row.edge_pct !== null && row.edge_pct !== undefined ? Number((row.edge_pct / 100).toFixed(4)) : (odds ? Number((p * odds - 1).toFixed(4)) : null);
      const fairOdds = row.fair_odds !== null && row.fair_odds !== undefined ? Number(row.fair_odds) : (p > 0 ? Number((1 / p).toFixed(2)) : null);

      let line: number = 2.5;
      if (row.reasoning) {
        try {
          const parsed = typeof row.reasoning === 'string' ? JSON.parse(row.reasoning) : row.reasoning;
          if (parsed && parsed.line !== undefined && parsed.line !== null) {
            line = Number(parsed.line);
          }
        } catch {
          // fallback to default
        }
      }

      if (isLocked) {
        return {
          id: row.id,
          home: row.home_team || 'Home',
          away: row.away_team || 'Away',
          league: row.league || 'League',
          kickoff: row.kickoff_utc || row.created_at,
          market: 'OU',
          selection: row.prediction || 'Over',
          line,
          locked: true,
        };
      }

      return {
        id: row.id,
        home: row.home_team || 'Home',
        away: row.away_team || 'Away',
        league: row.league || 'League',
        kickoff: row.kickoff_utc || row.created_at,
        market: 'OU',
        selection: row.prediction || 'Over',
        line,
        modelProb: p,
        marketOdds: odds,
        fairOdds: fairOdds,
        ev: ev,
        tier: isPro ? 'PRO' : 'FREE',
        locked: false,
      };
    });

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
      limit: FREE_VISIBLE_SIGNALS,
    });
  } catch (error: any) {
    console.error('Over Under API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
