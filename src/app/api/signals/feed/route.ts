import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { determineUserAccess, enforceFeedPolicy } from '../../../../lib/signals/visibility';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketParam = searchParams.get('market_type') || searchParams.get('market') || 'AH';
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const userId = request.headers.get('x-user-id') || undefined;

    // Filters
    const leagueParam = searchParams.get('competition') || searchParams.get('league') || undefined;
    const countryParam = searchParams.get('country') || undefined;
    const tierParam = searchParams.get('tier') || undefined;
    const confidenceFilterParam = searchParams.get('confidence') || undefined;
    const statusParam = searchParams.get('status') || 'active';

    // Determine user access
    const { isPremium } = await determineUserAccess(userId);

    // Map market code to DB category name
    let dbMarketCategory = '';
    const normMarket = marketParam.toUpperCase();
    if (normMarket === 'AH') {
      dbMarketCategory = 'asian_handicap';
    } else if (normMarket === 'OU') {
      dbMarketCategory = 'over_under';
    } else if (normMarket === 'ML') {
      dbMarketCategory = 'moneyline';
    }

    // Query signals
    let query = supabase
      .from('signals')
      .select('*, signal_metrics(*)');

    if (dbMarketCategory) {
      query = query.eq('market_category', dbMarketCategory);
    }

    if (statusParam === 'SETTLED') {
      query = query.not('status', 'in', '("OPEN", "LOCKED", "DRAFT", "pending", "settling", "LIVE")');
    } else {
      query = query.in('status', ['OPEN', 'LOCKED', 'pending', 'ACTIVE', 'LIVE', 'STALE']);
    }

    const { data: signals, error } = await query;

    if (error) {
      console.error('[Feed API] Database error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Fetch active competitions metadata from DB to override static registry values
    const { data: dbLeagues } = await supabase
      .from('leagues_cache')
      .select('*');

    // Fetch user preferences for personalized ranking
    let userPref: any = null;
    if (userId) {
      const { data: pref } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      userPref = pref;
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

      // 1. Resolve competition metadata from DB or fallback to static registry
      const leagueConfig = LEAGUE_REGISTRY.find(l => (l.name || '').toLowerCase() === (sig.league || '').toLowerCase());
      const dbLeague = (dbLeagues || []).find(dbl => 
        (dbl.name || '').toLowerCase() === (sig.league || '').toLowerCase() || 
        (dbl.competition_name || '').toLowerCase() === (sig.league || '').toLowerCase() ||
        (leagueConfig && String(dbl.api_id) === String(leagueConfig.apiFootballId))
      );

      const liquidityScore = dbLeague?.liquidity_score ?? leagueConfig?.liquidity_score ?? 50;
      const marketCoverageScore = dbLeague?.market_coverage_score ?? leagueConfig?.market_coverage_score ?? 50;
      const tier = dbLeague?.tier ?? leagueConfig?.tier ?? 3;
      const country = dbLeague?.country ?? leagueConfig?.country ?? 'Unknown';

      // 2. Score components calculation
      // edge_score: edge_pct * 10 (scale 0-100)
      const edgeScore = Math.min(100, Math.max(0, Number(sig.edge_pct || 0) * 10));
      const confidenceScoreValue = confidence * 100;
      const priorityScore = (edgeScore * 0.5) + (confidenceScoreValue * 0.3) + (liquidityScore * 0.2);

      // 3. Dynamic status & freshness monitoring
      const rawKickoff = sig.kickoff_utc || sig.kickoff_time || sig.created_at;
      const parseKickoff = rawKickoff ? new Date(rawKickoff) : new Date();
      const kickoffTime = isNaN(parseKickoff.getTime()) ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : parseKickoff;

      const rawLastOdds = sig.last_odds_update || sig.updated_at || sig.created_at;
      const parseLastOdds = rawLastOdds ? new Date(rawLastOdds) : new Date();
      const lastOddsUpdate = isNaN(parseLastOdds.getTime()) ? new Date() : parseLastOdds;

      const now = new Date();
      const isKickoffPassed = now.getTime() >= kickoffTime.getTime();

      const oddsAgeMinutes = sig.odds_age_minutes !== undefined && sig.odds_age_minutes !== null
        ? sig.odds_age_minutes
        : Math.max(0, Math.floor((now.getTime() - lastOddsUpdate.getTime()) / (1000 * 60)));

      // Stale threshold is 60 minutes
      const isOddsStale = oddsAgeMinutes > 60;

      let dynamicStatus = sig.status;
      if ((sig.kickoff_utc || sig.kickoff_time) && ['PENDING', 'ACTIVE', 'OPEN', 'LOCKED', 'LIVE', 'STALE', 'pending', 'active', 'open', 'locked', 'live', 'stale'].includes(sig.status)) {
        if (isKickoffPassed) {
          dynamicStatus = 'CLOSED';
        } else if (isOddsStale) {
          dynamicStatus = 'STALE';
        } else {
          dynamicStatus = 'ACTIVE';
        }
      }

      let preferenceBoost = 0;
      if (userPref) {
        const matchesComp = Array.isArray(userPref.preferred_competitions) && userPref.preferred_competitions.some((c: string) => (sig.league || '').toLowerCase() === c.toLowerCase());
        const matchesMarket = Array.isArray(userPref.preferred_markets) && userPref.preferred_markets.some((m: string) => {
          const normMarket = (sig.market || '').toLowerCase();
          const targetMarket = m.toLowerCase();
          return normMarket.includes(targetMarket) || targetMarket.includes(normMarket) ||
                 (normMarket === 'over_under' && targetMarket === 'over/under') ||
                 (normMarket === 'asian_handicap' && targetMarket === 'asian handicap');
        });
        const meetsConfidence = userPref.minimum_confidence ? (confidence * 100) >= Number(userPref.minimum_confidence) : true;
        const meetsEdge = userPref.minimum_edge ? Number(sig.edge_pct || 0) >= Number(userPref.minimum_edge) : true;

        if (matchesComp) preferenceBoost += 1000;
        if (matchesMarket) preferenceBoost += 500;
        if (meetsConfidence && userPref.minimum_confidence > 0) preferenceBoost += 200;
        if (meetsEdge && userPref.minimum_edge > 0) preferenceBoost += 200;
      }

      return {
        id: sig.id,
        match: `${sig.home_team} vs ${sig.away_team}`,
        league: sig.league,
        kickoff_time: sig.kickoff_utc || sig.kickoff_time,
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
        status: dynamicStatus,
        last_odds_update: lastOddsUpdate.toISOString(),
        odds_age_minutes: oddsAgeMinutes,
        published_at: sig.published_at || sig.created_at,
        priority_score: Number(priorityScore.toFixed(2)),
        sort_score: priorityScore + preferenceBoost,
        competition: {
          name: sig.league || 'Unknown League',
          country: country,
          tier: tier,
          liquidity_score: liquidityScore,
          market_coverage_score: marketCoverageScore
        }
      };
    });

    // Apply filters
    if (leagueParam) {
      feed = feed.filter(item => 
        (item.league || '').toLowerCase() === leagueParam.toLowerCase() || 
        (item.competition.name || '').toLowerCase() === leagueParam.toLowerCase()
      );
    }
    if (countryParam) {
      feed = feed.filter(item => (item.competition.country || '').toLowerCase() === countryParam.toLowerCase());
    }
    if (tierParam) {
      feed = feed.filter(item => Number(item.competition.tier) === Number(tierParam));
    }
    if (confidenceFilterParam) {
      const val = confidenceFilterParam.trim();
      if (val === '70+') {
        feed = feed.filter(item => (item.confidence_score * 100) >= 70);
      } else if (val === '80+') {
        feed = feed.filter(item => (item.confidence_score * 100) >= 80);
      } else if (val === '90+') {
        feed = feed.filter(item => (item.confidence_score * 100) >= 90);
      } else if (val.toLowerCase() === 'high') {
        feed = feed.filter(item => (item.confidence_score * 100) >= 70);
      } else if (val.toLowerCase() === 'medium') {
        feed = feed.filter(item => (item.confidence_score * 100) >= 40 && (item.confidence_score * 100) < 70);
      } else if (val.toLowerCase() === 'low') {
        feed = feed.filter(item => (item.confidence_score * 100) < 40);
      }
    }

    // Sort by sort_score DESC, then priority score DESC, then confidence DESC, then latest odds update DESC
    feed.sort((a, b) => {
      const scoreA = a.sort_score ?? a.priority_score;
      const scoreB = b.sort_score ?? b.priority_score;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
      }
      if (b.confidence_score !== a.confidence_score) {
        return b.confidence_score - a.confidence_score;
      }
      const timeA = new Date(a.last_odds_update || a.published_at).getTime();
      const timeB = new Date(b.last_odds_update || b.published_at).getTime();
      return timeB - timeA;
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
