import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const leagueParam = searchParams.get('league') || undefined;
    const timestamp = searchParams.get('timestamp') || undefined; // For REPLAY support

    // Base query on the materialized daily_picks view
    let query = supabase
      .from('daily_picks')
      .select('*')
      .eq('status', 'PENDING');
      
    // Point-in-time Replay vs Real Provider Run
    if (timestamp) {
      // Replay mode: only consider picks generated BEFORE the evaluation_time
      query = query.lte('created_at', timestamp);
    } else {
      // Real provider run: only consider upcoming fixtures
      query = query.gt('kickoff_utc', new Date().toISOString());
    }

    if (leagueParam) {
      query = query.ilike('league', leagueParam);
    }

    const { data: picks, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!picks) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    // Filter valid fixtures through the League Registry to ensure they belong to active/supported leagues
    const validLeagues = LEAGUE_REGISTRY.filter(l => l.status === 'ACTIVE' || l.status === 'BETA').map(l => l.name.toLowerCase());
    
    let filteredPicks = picks.filter(p => validLeagues.includes((p.league || '').toLowerCase()));

    // Map daily_picks back to ValueRecommendationRecord interface
    let recommendations = filteredPicks.map(p => {
      // Map verdict back to category
      let mappedCategory = 'PASS';
      let actionable = false;
      if (p.verdict === 'LAYAK') {
        mappedCategory = p.edge_pct && p.edge_pct >= 4 ? 'STRONG_VALUE' : 'VALUE';
        actionable = true;
      } else if (p.verdict === 'PANTAU') {
        mappedCategory = 'WATCHLIST';
      } else {
        mappedCategory = p.rejection_reason === 'MISSING_ODDS' ? 'PASS' : 'NO_VALUE';
      }

      const marketMapping: Record<string, string> = {
        'MONEYLINE': 'moneyline',
        'ASIAN_HANDICAP': 'asian_handicap',
        'OVER_UNDER': 'over_under',
        'BTTS': 'btts'
      };

      return {
        id: p.id,
        fixtureId: String(p.fixture_id),
        league: p.league,
        season: 'Current', // Not strictly stored in daily_picks, could be derived from date
        homeTeam: p.home_team,
        awayTeam: p.away_team,
        kickoff: p.kickoff_utc,
        market: marketMapping[p.market_type] || p.market_type,
        selection: p.prediction,
        line: 0, // Fallback since line is decoupled in DB right now
        modelProb: p.model_probability || 0,
        marketProb: p.market_odds ? (1 / p.market_odds) : 0,
        probEdge: (p.edge_pct || 0) / 100,
        modelFairOdds: p.fair_odds || 0,
        bookmakerOdds: p.market_odds || 0,
        expectedValue: (p.edge_pct || 0) / 100, // edge_pct correlates directly to EV here
        clvProjection: ((p.edge_pct || 0) / 100) * 0.65,
        category: mappedCategory,
        confidence: (p.confidence || 0) / 100,
        confidenceBucket: (p.confidence || 0) >= 70 ? 'HIGH' : ((p.confidence || 0) >= 58 ? 'MEDIUM' : 'LOW'),
        actionable,
        reason: p.reasoning || (p as any).rejection_reason || '',
        evidence: { cohortSize: 0, historicWinRate: 0, historicRoi: 0, significance: 'NOT_YET_VALIDATED' } // Calibration
      };
    });

    if (category) {
      recommendations = recommendations.filter(r => r.category === category);
    }

    return NextResponse.json({
      success: true,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
