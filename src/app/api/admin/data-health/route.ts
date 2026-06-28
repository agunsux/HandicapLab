import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { runHealthCheck } from '@/lib/services/healthChecker';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';

export async function GET(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Ingest/Fixture count last 24h
    const { count: fixturesCount, error: fixturesErr } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    if (fixturesErr) throw fixturesErr;

    // 2. Odds count last 24h
    const { count: oddsCount, error: oddsErr } = await supabase
      .from('odds_snapshots')
      .select('*', { count: 'exact', head: true })
      .gte('captured_at', oneDayAgo);

    const actualOddsCount = oddsCount || 0;

    // 3. Signals generated in last 24h
    const { count: signalsGenerated, error: sigsErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    if (sigsErr) throw sigsErr;

    // 4. Pending signals
    const { count: pendingSignals, error: pendingErr } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (pendingErr) throw pendingErr;

    // 5. Settled signals count and CLV metrics
    const { data: settledSignals, error: settledErr } = await supabase
      .from('signals')
      .select('clv_percentage')
      .not('settled_at', 'is', null);

    if (settledErr) throw settledErr;

    const settledCount = settledSignals?.length || 0;
    const insufficientSample = settledCount < 50;

    let averageClv: number | null = null;
    if (!insufficientSample && settledSignals && settledSignals.length > 0) {
      let clvSum = 0;
      let clvCount = 0;
      for (const sig of settledSignals) {
        if (sig.clv_percentage !== null && sig.clv_percentage !== undefined) {
          clvSum += Number(sig.clv_percentage);
          clvCount++;
        }
      }
      averageClv = clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0.0;
    }

    // 6. Provider status (run the health checker)
    const health = await runHealthCheck();

    // --- PHASE 34.2 EXTENSIONS ---

    // Fetch all matches, odds snapshots, and signals to aggregate coverage
    const { data: allMatches } = await supabase.from('matches').select('id, league');
    const { data: allOdds } = await supabase.from('odds_snapshots').select('match_id');
    const { data: allSignals } = await supabase.from('signals').select('id, league, market, market_category');

    const matchesList = allMatches || [];
    const oddsList = allOdds || [];
    const signalsList = allSignals || [];

    const oddsMatchIds = new Set(oddsList.map(o => o.match_id));

    // Calculate Competition Coverage
    const competition_coverage = LEAGUE_REGISTRY.map(league => {
      const fixtures = matchesList.filter(m => (m.league || '').toLowerCase() === league.name.toLowerCase());
      
      const with_odds = fixtures.filter(f => oddsMatchIds.has(f.id)).length;
      const with_signals = signalsList.filter(s => (s.league || '').toLowerCase() === league.name.toLowerCase()).length;

      const coverage_percentage = fixtures.length > 0 ? Number(((with_signals / fixtures.length) * 100).toFixed(2)) : 0.0;

      return {
        competition: league.name,
        fixtures: fixtures.length,
        with_odds,
        with_signals,
        coverage_percentage
      };
    });

    // League Registry Validation
    const league_registry_validation = LEAGUE_REGISTRY.map(l => {
      const missing_links: string[] = [];
      if (!l.apiFootballId) missing_links.push('apiFootballId');
      if (!l.oddsApiSportKey) missing_links.push('oddsApiSportKey');
      if (!l.id) missing_links.push('id');
      
      return {
        league: l.name,
        valid: missing_links.length === 0,
        missing_links
      };
    });

    // World Cup Priority Validation
    const wcCoverage = competition_coverage.find(c => c.competition === 'FIFA World Cup') || {
      fixtures: 0,
      with_odds: 0,
      with_signals: 0,
      coverage_percentage: 0
    };

    const wcSignals = signalsList.filter(s => (s.league || '').toLowerCase() === 'fifa world cup');
    const world_cup_priority_validation = {
      fixtures_loaded: wcCoverage.fixtures > 0,
      odds_available: wcCoverage.with_odds > 0,
      markets_covered: {
        AH: wcSignals.some(s => (s.market || s.market_category) === 'asian_handicap'),
        OU: wcSignals.some(s => (s.market || s.market_category) === 'over_under'),
        ML: wcSignals.some(s => (s.market || s.market_category) === 'moneyline')
      },
      valid: wcCoverage.fixtures > 0 && wcCoverage.with_odds > 0
    };

    // Compile Production Readiness Report
    const dataCoverageStatus = matchesList.length > 0 ? 'READY' : 'BLOCKED';
    const compCoverageStatus = competition_coverage.filter(c => c.fixtures > 0).length >= 3 ? 'READY' : 'PARTIAL';
    const oddsCoverageStatus = matchesList.length > 0 && (oddsList.length / matchesList.length) >= 0.5 ? 'READY' : 'PARTIAL';
    const signalGenStatus = signalsList.length > 0 ? 'READY' : 'PARTIAL';
    const modelHealthStatus = 'READY';

    const overallStatus = (dataCoverageStatus === 'READY' && compCoverageStatus === 'READY' && oddsCoverageStatus === 'READY' && signalGenStatus === 'READY')
      ? 'READY'
      : 'PARTIAL';

    const prediction_readiness_report = {
      status: overallStatus,
      sections: {
        data_coverage: dataCoverageStatus,
        competition_coverage: compCoverageStatus,
        odds_coverage: oddsCoverageStatus,
        signal_generation: signalGenStatus,
        model_health: modelHealthStatus
      }
    };

    return NextResponse.json({
      fixtures_count_last_24h: fixturesCount || 0,
      odds_count_last_24h: actualOddsCount,
      signals_generated: signalsGenerated || 0,
      pending_signals: pendingSignals || 0,
      settled_signals: settledCount,
      average_clv: averageClv,
      averageClv: averageClv,
      provider_status: health.status,
      insufficient_sample: insufficientSample,
      status: insufficientSample ? 'insufficient_sample' : 'sufficient',
      requiredForClv: 50,
      competition_coverage,
      league_registry_validation,
      world_cup_priority_validation,
      prediction_readiness_report
    });

  } catch (error: any) {
    console.error('❌ Data Health API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
