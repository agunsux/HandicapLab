import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getUserEntitlements } from '@/lib/pricing/entitlement';
import { FREE_VISIBLE_SIGNALS } from '@/config/entitlements';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
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
      .from('prediction_ledger_v3')
      .select('*, matches!inner(id, home_team, away_team, league, kickoff, status)')
      .order('expected_value', { ascending: false })
      .limit(limitParam);

    const now = new Date();
    if (dateParam === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      query = query.gte('matches.kickoff', startOfDay).lte('matches.kickoff', endOfDay);
    } else if (dateParam === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();
      query = query.gte('matches.kickoff', startOfDay).lte('matches.kickoff', endOfDay);
    } else {
      query = query.gt('matches.kickoff', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((row: any, index: number) => {
      const isLocked = !isPro && index >= FREE_VISIBLE_SIGNALS;
      const match = row.matches;
      const p = row.calibrated_probability || 0.5;
      const odds = row.market_odds || 1.95;
      const ev = row.expected_value ?? (p * odds - 1);
      const fairOdds = p > 0 ? Number((1 / p).toFixed(2)) : null;

      if (isLocked) {
        return {
          id: row.id,
          home: match?.home_team || 'Home',
          away: match?.away_team || 'Away',
          league: match?.league || 'League',
          kickoff: match?.kickoff || row.prediction_timestamp,
          market: row.market_type,
          selection: row.selection || 'home',
          line: row.line !== undefined && row.line !== null ? Number(row.line) : undefined,
          locked: true,
        };
      }

      return {
        id: row.id,
        home: match?.home_team || 'Home',
        away: match?.away_team || 'Away',
        league: match?.league || 'League',
        kickoff: match?.kickoff || row.prediction_timestamp,
        market: row.market_type,
        selection: row.selection || 'home',
        line: row.line !== undefined && row.line !== null ? Number(row.line) : undefined,
        modelProb: p,
        marketOdds: odds,
        fairOdds: fairOdds,
        ev: Number(ev.toFixed(4)),
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
    console.error('Signals Union API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
