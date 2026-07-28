// Stage A — Real-data query layer for Results page.
// Wires to: prediction_results + prediction_audits (settled predictions).

import { supabase } from '@/lib/supabase.server';

export interface ResultRow {
  id: string;
  date: string;
  league: string;
  fixture: string;
  market: string;
  odds: number;
  result: string;
  profit: string;
  roi: string;
  clv: string;
  verified: boolean;
}

export interface ResultsFilter {
  league?: string;
  market?: string;
  from?: string;
  to?: string;
}

export async function fetchSettledResults(filter?: ResultsFilter): Promise<ResultRow[]> {
  try {
    let query = supabase
      .from('prediction_audits')
      .select(`
        id,
        fixture_id,
        league,
        market,
        selection,
        odds_at_prediction,
        settlement,
        profit,
        roi,
        clv,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter?.league) {
      query = query.eq('league', filter.league);
    }
    if (filter?.market) {
      query = query.ilike('market', `%${filter.market}%`);
    }

    const { data: audits, error } = await query;

    if (error || !audits || audits.length === 0) {
      return [];
    }

    const fixtureIds = [...new Set(audits.map((a: any) => a.fixture_id))];
    const { data: matches } = await supabase
      .from('matches')
      .select('id, home_team, away_team')
      .in('id', fixtureIds.slice(0, 50));

    const matchMap = new Map<string, { home: string; away: string }>();
    if (matches) {
      for (const m of matches) {
        matchMap.set(m.id, { home: m.home_team, away: m.away_team });
      }
    }

    return audits.map((a: any) => {
      const match = matchMap.get(a.fixture_id);
      const fixtureLabel = match ? `${match.home} vs ${match.away}` : `Match ${a.fixture_id}`;

      const statusLabel = a.settlement === 'WIN' ? 'Won' : a.settlement === 'LOSS' ? 'Loss' : a.settlement === 'PUSH' ? 'Push' : a.settlement === 'HALF_WIN' ? 'Half Win' : a.settlement === 'HALF_LOSS' ? 'Half Loss' : a.settlement || '';

      return {
        id: a.id,
        date: a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : '',
        league: a.league || '',
        fixture: fixtureLabel,
        market: a.market || '',
        odds: Number(a.odds_at_prediction || 0),
        result: statusLabel,
        profit: `${Number(a.profit || 0).toFixed(2)}`,
        roi: `${Number((a.roi || 0) * 100).toFixed(1)}%`,
        clv: `${Number(a.clv || 0).toFixed(1)}%`,
        verified: a.settlement !== 'PENDING' && a.settlement !== null,
      };
    });
  } catch (err) {
    console.warn('[Results Query] Failed:', err);
    return [];
  }
}
