import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';
import { FeatureEngine } from '@/lib/engines/feature-engine';
import { ProbabilityEngine } from '@/lib/engines/probability-engine';
import { CalibrationEngine } from '@/lib/engine/calibration';
import { toFiniteNumber, isMalformed } from '@/lib/utils/number';
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { competition } = body;

    const validationLeagues = [
      'FIFA World Cup',
      'Premier League',
      'La Liga',
      'Serie A',
      'Bundesliga',
      'J League',
      'K League',
      'MLS'
    ];

    let query = supabase.from('matches').select('*').eq('status', 'upcoming');

    if (competition) {
      query = query.eq('league', competition);
    } else {
      query = query.in('league', validationLeagues);
    }

    const { data: fixtures, error: fixturesErr } = await query;
    if (fixturesErr) {
      return NextResponse.json({ success: false, error: fixturesErr.message }, { status: 500 });
    }

    const thresholds = await CalibrationEngine.getDynamicThresholds();

    let fixtures_checked = 0;
    let odds_available = 0;
    let signals_generated = 0;

    const insertPayloads: any[] = [];

    for (const match of (fixtures || [])) {
      fixtures_checked++;

      // Fetch Pinnacle odds snapshot
      const { data: oddsSnap } = await supabase
        .from('odds_snapshots')
        .select('*')
        .eq('match_id', match.id)
        .maybeSingle();

      if (!oddsSnap) continue;
      odds_available++;

      // Fetch ratings
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

      for (const mkt of ['ML', 'AH', 'OU'] as const) {
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

          const probability = toFiniteNumber(mkt === 'ML' ? probOutput.pHome : mkt === 'AH' ? probOutput.pAhHome : probOutput.pOver);
          const odds = toFiniteNumber(oddsSnapshot.homeOdds);
          if (probability === null || odds === null || probability <= 0 || odds <= 0) {
            const rawOdds = oddsSnap.odds_home;
            const rawProbability = mkt === 'ML' ? probOutput.pHome : mkt === 'AH' ? probOutput.pAhHome : probOutput.pOver;
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
            insertPayloads.push({
              fixture_id: match.id,
              competition: match.league,
              market_type: mkt,
              predicted_pick: mkt === 'ML' ? 'home' : (oddsSnapshot.line ? `home_${oddsSnapshot.line}` : 'over'),
              predicted_probability: probability,
              predicted_edge: edge,
              odds_at_prediction: odds
            });
          }
        } catch (err) {
          // ignore individual modeling fails
        }
      }
    }

    if (insertPayloads.length > 0) {
      const { error: insertErr } = await supabase
        .from('shadow_predictions')
        .insert(insertPayloads);
      
      if (insertErr) {
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      fixtures_checked,
      odds_available,
      signals_generated
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
