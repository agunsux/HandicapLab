import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { determineUserAccess, enforceFeedPolicy } from '../../../../lib/signals/visibility';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get('market') || 'AH';
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const userId = request.headers.get('x-user-id') || undefined;

    // Additional filters
    const leagueParam = searchParams.get('league') || undefined;
    const countryParam = searchParams.get('country') || undefined;
    const confidenceFilterParam = searchParams.get('confidence') || undefined;

    // Determine user access
    const { isPremium, dailyLimit } = await determineUserAccess(userId);

    const statusParam = searchParams.get('status') || 'active';

    // Map market code to DB category name
    let dbMarketCategory = '';
    if (marketParam === 'AH') {
      dbMarketCategory = 'asian_handicap';
    } else if (marketParam === 'OU') {
      dbMarketCategory = 'over_under';
    } else if (marketParam === 'ML') {
      dbMarketCategory = 'moneyline';
    }

    // Query OPEN/LOCKED or SETTLED signals
    let query = supabase
      .from('signals')
      .select('*, signal_metrics(*)');

    if (dbMarketCategory) {
      query = query.eq('market_category', dbMarketCategory);
    }

    if (statusParam === 'SETTLED') {
      query = query.not('status', 'in', '("OPEN", "LOCKED", "DRAFT", "pending", "settling", "LIVE")');
    } else {
      query = query.in('status', ['OPEN', 'LOCKED']);
    }

    const { data: signals, error } = await query
      .order('published_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('[Feed API] Database error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Map raw DB rows to normalized API structure
    let feed = (signals || []).map(sig => {
      const metricsObj = Array.isArray(sig.signal_metrics) ? sig.signal_metrics[0] : sig.signal_metrics;
      const confidence = Number(sig.confidence || 0.5);

      let confidenceLabel = 'LOW';
      if (confidence >= 0.70) {
        confidenceLabel = 'HIGH';
      } else if (confidence >= 0.40) {
        confidenceLabel = 'MEDIUM';
      }

      // Find league config for metadata
      const leagueConfig = LEAGUE_REGISTRY.find(l => (l.name || '').toLowerCase() === (sig.league || '').toLowerCase());
      const liquidityScore = leagueConfig?.liquidity_score ?? 50;

      // Score components:
      // edge_score: edge_pct * 10 (scale 0-100)
      // confidence_score: confidence * 100 (scale 0-100)
      // liquidity_score: config score (scale 0-100)
      const edgeScore = Math.min(100, Math.max(0, Number(sig.edge_pct || 0) * 10));
      const confidenceScoreValue = confidence * 100;
      const priorityScore = (edgeScore * 0.5) + (confidenceScoreValue * 0.3) + (liquidityScore * 0.2);

      return {
        id: sig.id,
        match: `${sig.home_team} vs ${sig.away_team}`,
        league: sig.league,
        kickoff_time: sig.kickoff_utc,
        market_category: sig.market_category || sig.market,
        market_selection: sig.market_selection || sig.selection,
        odds: Number(sig.odds || 1.00),
        opening_odds: Number(sig.opening_odds || sig.odds || 1.00),
        current_odds: Number(sig.closing_odds || sig.odds || 1.00),
        clv_percentage: sig.clv_percentage !== null ? Number(sig.clv_percentage) : (sig.clv !== null ? Number(sig.clv) * 100 : null),
        edge_percentage: Number(sig.edge_pct || 0.0),
        confidence_score: confidence,
        confidence_label: confidenceLabel,
        sample_size: metricsObj?.sample_size || 45,
        model_version: sig.model_version || 'rule_v1',
        status: sig.status,
        published_at: sig.published_at || sig.created_at,
        priority_score: Number(priorityScore.toFixed(2)),
        competition: {
          name: sig.league || 'Unknown League',
          country: leagueConfig?.country || 'Unknown',
          tier: leagueConfig?.tier || 3,
          liquidity_score: liquidityScore,
          market_coverage_score: leagueConfig?.market_coverage_score || 50
        }
      };
    });

    // Apply in-memory filters
    if (leagueParam) {
      feed = feed.filter(item => item.league?.toLowerCase() === leagueParam.toLowerCase());
    }
    if (countryParam) {
      feed = feed.filter(item => item.competition.country?.toLowerCase() === countryParam.toLowerCase());
    }
    if (confidenceFilterParam) {
      feed = feed.filter(item => item.confidence_label?.toLowerCase() === confidenceFilterParam.toLowerCase());
    }

    // Sort by priority score descending
    feed.sort((a, b) => b.priority_score - a.priority_score);

    // Enforce visibility masking and daily slicing policy
    const processedFeed = enforceFeedPolicy(feed, isPremium, limitParam);

    return NextResponse.json({
      success: true,
      count: processedFeed.length,
      is_premium: isPremium,
      feed: processedFeed
    });
  } catch (error: any) {
    console.error('[Feed API] Fatal Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
