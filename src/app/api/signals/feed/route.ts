import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { determineUserAccess, enforceFeedPolicy } from '../../../../lib/signals/visibility';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get('market') || 'AH';
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const userId = request.headers.get('x-user-id') || undefined;

    // Determine user access
    const { isPremium, dailyLimit } = await determineUserAccess(userId);

    const statusParam = searchParams.get('status') || 'active';

    // Map market code to DB category name
    let dbMarketCategory = 'asian_handicap';
    if (marketParam === 'OU') {
      dbMarketCategory = 'over_under';
    } else if (marketParam === 'ML') {
      dbMarketCategory = 'moneyline';
    }

    // Query OPEN/LOCKED or SETTLED signals
    let query = supabase
      .from('signals')
      .select('*, signal_metrics(*)')
      .eq('market_category', dbMarketCategory);

    if (statusParam === 'SETTLED') {
      query = query.not('status', 'in', '("OPEN", "LOCKED", "DRAFT", "pending", "settling", "LIVE")');
    } else {
      query = query.in('status', ['OPEN', 'LOCKED']);
    }

    const { data: signals, error } = await query
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('confidence', { ascending: false });

    if (error) {
      console.error('[Feed API] Database error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Map raw DB rows to normalized API structure
    const feed = (signals || []).map(sig => {
      const metricsObj = Array.isArray(sig.signal_metrics) ? sig.signal_metrics[0] : sig.signal_metrics;
      const confidence = Number(sig.confidence || 0.5);

      let confidenceLabel = 'LOW';
      if (confidence >= 0.70) {
        confidenceLabel = 'HIGH';
      } else if (confidence >= 0.40) {
        confidenceLabel = 'MEDIUM';
      }

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
        published_at: sig.published_at || sig.created_at
      };
    });

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
