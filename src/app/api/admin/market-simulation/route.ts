import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';
import { FeatureEngine } from '@/lib/engines/feature-engine';
import { ProbabilityEngine } from '@/lib/engines/probability-engine';
import { CalibrationEngine } from '@/lib/engine/calibration';
import { ModelIntelligenceAdjuster } from '@/lib/intelligence/adjuster';
import { toFiniteNumber, isMalformed } from '@/lib/utils/number';

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { startDate, endDate, competition } = body;

    const isWcMode = competition === 'WORLD_CUP_MODE';

    let query = supabase.from('matches').select('*').eq('status', 'upcoming');

    if (isWcMode) {
      query = query.eq('league', 'FIFA World Cup');
    } else if (competition) {
      query = query.eq('league', competition);
    }

    if (startDate) {
      query = query.gte('kickoff', startDate);
    }
    if (endDate) {
      query = query.lte('kickoff', endDate);
    }

    const { data: fixtures, error: fixturesErr } = await query;
    if (fixturesErr) {
      return NextResponse.json({ success: false, error: fixturesErr.message }, { status: 500 });
    }

    const thresholds = await CalibrationEngine.getDynamicThresholds();

    let matches_analyzed = 0;
    let signals_generated = 0;
    let totalConfidence = 0;
    let totalEdge = 0;
    let fixturesWithOdds = 0;

    const simulatedSignals: any[] = [];

    const marketsAnalyzed = { AH: 0, OU: 0, ML: 0 };

    for (const match of (fixtures || [])) {
      matches_analyzed++;

      // Fetch dynamic ratings
      const { data: homeRating } = await supabase
        .from('team_ratings')
        .select('*')
        .eq('team_id', match.home_team)
        .maybeSingle();

      const { data: awayRating } = await supabase
        .from('team_ratings')
        .select('*')
        .eq('team_id', match.away_team)
        .maybeSingle();

      // Fetch Pinnacle odds snapshot
      const { data: oddsSnap } = await supabase
        .from('odds_snapshots')
        .select('*')
        .eq('match_id', match.id)
        .maybeSingle();

      if (!oddsSnap) continue;

      fixturesWithOdds++;

      // Run prediction logic on ML, AH, OU markets
      for (const mkt of ['ML', 'AH', 'OU'] as const) {
        marketsAnalyzed[mkt]++;

        try {
          const features = await FeatureEngine.build(match.id, new Date(match.kickoff), mkt);
          if (homeRating && awayRating) {
            features.homeAttack = Number(homeRating.attack_strength);
            features.homeDefense = Number(homeRating.defense_strength);
            features.awayAttack = Number(awayRating.attack_strength);
            features.awayDefense = Number(awayRating.defense_strength);
          }

          const oddsSnapshot = {
            bookmaker: 'pinnacle',
            homeOdds: Number(oddsSnap.odds_home),
            awayOdds: Number(oddsSnap.odds_away),
            drawOdds: oddsSnap.odds_draw ? Number(oddsSnap.odds_draw) : undefined,
            line: oddsSnap.handicap_line ? Number(oddsSnap.handicap_line) : undefined
          };

          const probOutput = await ProbabilityEngine.predict(features, { oddsSnapshot });
          if (!probOutput || !probOutput.confidence) continue;

          const probability = toFiniteNumber(probOutput.pHome);
          const odds = toFiniteNumber(oddsSnapshot.homeOdds);
          if (probability === null || odds === null || probability <= 0 || odds <= 0) {
            const rawOdds = oddsSnap.odds_home;
            const rawProbability = probOutput.pHome;
            if (isMalformed(rawOdds) || isMalformed(rawProbability)) {
              console.warn("Skipping invalid market data", {
                fixtureId: match.id,
                homeTeam: match.home_team,
                awayTeam: match.away_team,
                market: mkt,
                rawOdds,
                rawProbability
              });
            }
            continue;
          }
          const edge = ((odds * probability) - 1.0) * 100;
          const threshold = thresholds[mkt];

          if (edge >= threshold) {
            signals_generated++;
            const rawConf = Math.round(probOutput.confidence.finalConfidence * 100);
            
            // Adjust confidence dynamically
            const adjustedConf = ModelIntelligenceAdjuster.adjustConfidence(
              rawConf,
              75, // default quality score
              0   // no steam on dry run / first snapshot
            );

            totalConfidence += adjustedConf;
            totalEdge += edge;

            simulatedSignals.push({
              Match: `${match.home_team} vs ${match.away_team}`,
              Market: mkt === 'ML' ? 'Moneyline' : (mkt === 'AH' ? 'Asian Handicap' : 'Over/Under'),
              Pick: mkt === 'ML' ? 'home' : (oddsSnapshot.line ? `home_${oddsSnapshot.line}` : 'over'),
              Confidence: `${adjustedConf}%`,
              Edge: `${edge.toFixed(2)}%`,
              Bookmaker: 'Pinnacle',
              Line: oddsSnapshot.line !== undefined ? oddsSnapshot.line : 0.0
            });
          }
        } catch (err) {
          // ignore individual simulation errors
        }
      }
    }

    const avgConfidence = signals_generated > 0 ? totalConfidence / signals_generated : 0;
    const avgEdge = signals_generated > 0 ? totalEdge / signals_generated : 0;
    const oddsCoverage = matches_analyzed > 0 ? (fixturesWithOdds / matches_analyzed) * 100 : 0;
    const signalRate = matches_analyzed > 0 ? (signals_generated / matches_analyzed) * 100 : 0;

    const simulation_report = {
      competition_coverage: LEAGUE_REGISTRY.filter(l => l.enabled).length,
      odds_coverage: Number(oddsCoverage.toFixed(2)),
      signal_rate: Number(signalRate.toFixed(2)),
      average_confidence: Number(avgConfidence.toFixed(2)),
      average_edge: Number(avgEdge.toFixed(2))
    };

    return NextResponse.json({
      success: true,
      competition: isWcMode ? 'WORLD_CUP_MODE' : (competition || 'All'),
      matches_analyzed,
      markets_analyzed: marketsAnalyzed,
      signals_generated,
      average_confidence: Number(avgConfidence.toFixed(2)),
      average_edge: Number(avgEdge.toFixed(2)),
      signals: simulatedSignals,
      simulation_report
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
