import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';
import { FeatureEngine } from '@/lib/engines/feature-engine';
import { ProbabilityEngine } from '@/lib/engines/probability-engine';
import { CalibrationEngine } from '@/lib/engine/calibration';
import { toFiniteNumber } from '@/lib/utils/number';
export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-admin-secret');
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { competition_id } = body;

    const leagueConfig = LEAGUE_REGISTRY.find(l => l.id === competition_id);
    if (!leagueConfig) {
      return NextResponse.json({ success: false, error: 'League registry configuration not found.' }, { status: 404 });
    }

    // Fetch upcoming fixtures
    const { data: fixtures, error: fixturesErr } = await supabase
      .from('matches')
      .select('*')
      .eq('league', leagueConfig.name)
      .eq('status', 'upcoming');

    if (fixturesErr) {
      return NextResponse.json({ success: false, error: fixturesErr.message }, { status: 500 });
    }

    const thresholds = await CalibrationEngine.getDynamicThresholds();

    let fixtures_checked = 0;
    let odds_found = 0;
    let signals_possible = 0;
    const reasons_skipped = {
      LOW_EDGE: 0,
      NO_ODDS: 0,
      STALE_ODDS: 0,
      INSUFFICIENT_DATA: 0
    };

    for (const match of (fixtures || [])) {
      fixtures_checked++;

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

      if (!homeRating || !awayRating) {
        reasons_skipped.INSUFFICIENT_DATA++;
        continue;
      }

      // Fetch Pinnacle odds snapshot from database
      const { data: oddsSnap } = await supabase
        .from('odds_snapshots')
        .select('*')
        .eq('match_id', match.id)
        .maybeSingle();

      if (!oddsSnap) {
        reasons_skipped.NO_ODDS++;
        continue;
      }

      // Stale odds check (captured_at older than 60 mins)
      const oddsAgeMs = Date.now() - new Date(oddsSnap.captured_at).getTime();
      if (oddsAgeMs > 60 * 60 * 1000) {
        reasons_skipped.STALE_ODDS++;
        continue;
      }

      odds_found++;

      // Run prediction logic on AH, OU, ML markets
      let hasSignal = false;
      for (const mkt of ['ML', 'AH', 'OU'] as const) {
        try {
          const features = await FeatureEngine.build(match.id, new Date(match.kickoff), mkt);
          features.homeAttack = Number(homeRating.attack_strength);
          features.homeDefense = Number(homeRating.defense_strength);
          features.awayAttack = Number(awayRating.attack_strength);
          features.awayDefense = Number(awayRating.defense_strength);

          // Convert snapshot fields to expected engine structure
          const oddsSnapshot = {
            bookmaker: 'pinnacle',
            homeOdds: Number(oddsSnap.odds_home),
            awayOdds: Number(oddsSnap.odds_away),
            drawOdds: oddsSnap.odds_draw ? Number(oddsSnap.odds_draw) : undefined,
            line: oddsSnap.handicap_line ? Number(oddsSnap.handicap_line) : undefined
          };

          const probOutput = await ProbabilityEngine.predict(features, { oddsSnapshot });
          if (!probOutput || !probOutput.confidence) continue;

          // Check threshold and edge
          const probability = toFiniteNumber(mkt === 'ML' ? probOutput.pHome : mkt === 'AH' ? probOutput.pAhHome : probOutput.pOver);
          const odds = toFiniteNumber(oddsSnapshot.homeOdds);
          if (probability === null || odds === null || probability <= 0 || odds <= 0) {
            console.warn("Skipping invalid market data", { probability, odds, market: mkt });
            continue;
          }
          const edge = ((odds * probability) - 1.0) * 100;
          const threshold = thresholds[mkt];

          if (edge >= threshold) {
            hasSignal = true;
          }
        } catch (err) {
          // ignore individual feature build failures
        }
      }

      if (hasSignal) {
        signals_possible++;
      } else {
        reasons_skipped.LOW_EDGE++;
      }
    }

    return NextResponse.json({
      success: true,
      fixtures_checked,
      odds_found,
      signals_possible,
      reasons_skipped
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
