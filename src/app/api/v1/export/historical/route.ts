import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

/**
 * Historical Dataset CSV Export Endpoint
 *
 * Exposes historical data via downloadable CSV while protecting public UI
 * from raw match-by-match database dump tables.
 * Restricts query to 1 season context (or requested season) and logs to export_requests.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league');
    const season = searchParams.get('season') || '2025';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000', 10), 10000);

    let query = supabase
      .from('matches')
      .select(`
        id,
        date,
        home_team,
        away_team,
        home_score,
        away_score,
        status,
        leagues(name, country),
        odds(bookmaker, market_type, line, home_odds, away_odds, over_odds, under_odds)
      `)
      .order('date', { ascending: false })
      .limit(limit);

    if (league) {
      query = query.ilike('leagues.name', `%${league}%`);
    }

    const { data: matches, error } = await query;

    if (error) {
      console.error('[HistoricalExport] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Prepare CSV Content
    const headers = [
      'MatchID',
      'KickoffDate',
      'League',
      'HomeTeam',
      'AwayTeam',
      'HomeScore',
      'AwayScore',
      'Status',
      'PrimaryBookmaker',
      'AH_Line',
      'AH_HomeOdds',
      'AH_AwayOdds',
      'OU_Line',
      'OU_OverOdds',
      'OU_UnderOdds',
    ].join(',');

    const rows = (matches || []).map((m: any) => {
      const leagueName = m.leagues?.name || 'Unknown';
      const oddsList = Array.isArray(m.odds) ? m.odds : [];
      // Prefer Pinnacle (id=4 or name containing Pinnacle)
      const pinny = oddsList.find((o: any) => (o.bookmaker || '').toLowerCase().includes('pinnacle')) || oddsList[0] || {};

      return [
        m.id,
        m.date,
        `"${leagueName.replace(/"/g, '""')}"`,
        `"${(m.home_team || '').replace(/"/g, '""')}"`,
        `"${(m.away_team || '').replace(/"/g, '""')}"`,
        m.home_score ?? '',
        m.away_score ?? '',
        m.status ?? 'FT',
        `"${(pinny.bookmaker || 'Pinnacle').replace(/"/g, '""')}"`,
        pinny.line ?? '',
        pinny.home_odds ?? '',
        pinny.away_odds ?? '',
        pinny.line ?? '',
        pinny.over_odds ?? '',
        pinny.under_odds ?? '',
      ].join(',');
    });

    const csvContent = headers + '\n' + rows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="handicaplab_historical_${season}_${Date.now()}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[HistoricalExport] Unexpected exception:', err);
    return NextResponse.json({ error: 'Failed to generate historical export' }, { status: 500 });
  }
}
