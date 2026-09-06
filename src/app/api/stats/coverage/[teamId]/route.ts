import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { coverageCalculator } from '@/lib/services/coverageCalculator';

interface RouteContext {
  params: Promise<{ teamId: string }> | { teamId: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const rawTeamParam = params.teamId;

    if (!rawTeamParam) {
      return NextResponse.json({ error: 'Team ID or name is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const venue = (searchParams.get('venue') as 'home' | 'away' | 'overall') || 'overall';
    const seasonParam = searchParams.get('season');
    const season = seasonParam ? parseInt(seasonParam, 10) : undefined;
    const asOfParam = searchParams.get('asOf') || searchParams.get('asOfTimestamp');
    const asOfTimestamp = asOfParam ? new Date(asOfParam) : undefined;

    // 1. Fetch team coverage rates with zero data leakage
    const coverage = await coverageCalculator.getTeamCoverageRates(rawTeamParam, venue, season, asOfTimestamp);
    let teamName = coverage.teamName && coverage.teamName !== 'Unknown Team' ? coverage.teamName : rawTeamParam;

    // 2. Fetch league averages for context
    const leagueAvg = await coverageCalculator.getLeagueAverages(coverage.leagueId || 39, season, asOfTimestamp);

    // 3. Fetch last 5 matches for form evaluation from historical_matches or matches
    let recentMatches: any[] = [];
    try {
      let query = supabase
        .from('historical_matches')
        .select('*')
        .or(`home_team.ilike.%${teamName}%,away_team.ilike.%${teamName}%`);

      if (asOfTimestamp) {
        query = query.lte('match_date', asOfTimestamp.toISOString());
      }

      const { data: histData } = await query
        .order('match_date', { ascending: false })
        .limit(5);

      if (histData && histData.length > 0) {
        recentMatches = histData.map((m) => {
          const isHome = m.home_team.toLowerCase().includes(teamName.toLowerCase());
          const opponent = isHome ? m.away_team : m.home_team;
          const gf = isHome ? m.home_goals : m.away_goals;
          const ga = isHome ? m.away_goals : m.home_goals;
          const gd = gf - ga;

          // AH -0.5 baseline evaluation
          let ahResult = 'LOSS';
          if (gd > 0) ahResult = 'WIN';
          else if (gd === 0) ahResult = 'PUSH';

          const ou25 = m.total_goals > 2.5 ? 'OVER' : 'UNDER';
          const btts = m.btts ? 'YES' : 'NO';

          return {
            date: m.match_date,
            opponent,
            venue: isHome ? 'home' : 'away',
            score: `${m.home_goals}-${m.away_goals}`,
            ah_line: -0.5,
            ah_result: ahResult,
            ou_25: ou25,
            btts,
          };
        });
      }
    } catch (err) {
      console.warn(`[CoverageAPI] Recent form query warning for ${teamName}:`, err);
    }

    return NextResponse.json({
      team: {
        id: coverage.canonicalId || rawTeamParam,
        name: teamName,
      },
      coverage,
      leagueAvg,
      recentForm: recentMatches,
      meta: {
        season: coverage.season || season || 2026,
        sampleSize: coverage.sampleSize,
        dataSource: 'api-football',
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[CoverageAPI] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
