import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { footyStatsApi } from '@/services/footystats.api';
import { MatchInput } from '@/services/probability.engine';
import { processAndStorePrediction } from '@/services/prediction.ledger';

export async function GET(request: Request) {
  // Cron Security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const matches = await footyStatsApi.getMatchesForTomorrow();
    let processedCount = 0;
    let skippedCount = 0;

    for (const match of matches) {
      // 1. Idempotency Check
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('footystats_id', match.id)
        .single();

      if (existingMatch) {
        skippedCount++;
        continue;
      }

      // 2. Upsert Teams
      // Home Team
      const { data: homeTeam, error: homeErr } = await supabase
        .from('teams')
        .upsert({
          footystats_id: match.homeID,
          name: match.home_name,
          league: match.competition_name
        }, { onConflict: 'footystats_id' })
        .select('id')
        .single();

      // Away Team
      const { data: awayTeam, error: awayErr } = await supabase
        .from('teams')
        .upsert({
          footystats_id: match.awayID,
          name: match.away_name,
          league: match.competition_name
        }, { onConflict: 'footystats_id' })
        .select('id')
        .single();

      if (homeErr || awayErr || !homeTeam || !awayTeam) {
        console.error('Error upserting teams for match', match.id, homeErr, awayErr);
        continue;
      }

      // 3. Insert Match
      const matchDate = new Date(match.date_unix * 1000).toISOString();
      const { data: newMatch, error: matchErr } = await supabase
        .from('matches')
        .insert({
          footystats_id: match.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          match_date: matchDate,
          status: 'scheduled'
        })
        .select('id')
        .single();

      if (matchErr || !newMatch) {
        console.error('Error inserting match', match.id, matchErr);
        continue;
      }

      const matchId = newMatch.id;

      // 4. Insert Market Snapshot
      await supabase.from('market_snapshots').insert({
        match_id: matchId,
        odds_home: match.odds_ft_1,
        odds_draw: match.odds_ft_x,
        odds_away: match.odds_ft_2,
        btts_yes_odds: match.odds_btts_yes,
        btts_no_odds: match.odds_btts_no,
        asian_handicap_line: match.odds_asian_handicap || 0,
        over_under_line: match.odds_over_under_25 || 2.5
      });

      // 5. Insert Stats Snapshot
      await supabase.from('stats_snapshots').insert({
        match_id: matchId,
        xg_home: match.team_a_xg,
        xg_away: match.team_b_xg,
        shots_home: match.team_a_shots,
        shots_away: match.team_b_shots,
        shots_on_target_home: match.team_a_shotsOnTarget,
        shots_on_target_away: match.team_b_shotsOnTarget,
        corners_home: match.team_a_corners,
        corners_away: match.team_b_corners,
        form_home: match.team_a_form || 3,
        form_away: match.team_b_form || 3
      });

      // 6. Generate and Store Prediction
      const engineInput: MatchInput = {
        odds_home: match.odds_ft_1,
        odds_draw: match.odds_ft_x,
        odds_away: match.odds_ft_2,
        ah_line: match.odds_asian_handicap || 0,
        ou_line: match.odds_over_under_25 || 2.5,
        btts_odds: match.odds_btts_yes,
        xg_home: match.team_a_xg,
        xg_away: match.team_b_xg,
        shots_home: match.team_a_shots,
        shots_away: match.team_b_shots,
        shots_on_target_home: match.team_a_shotsOnTarget,
        shots_on_target_away: match.team_b_shotsOnTarget,
        form_home: match.team_a_form || 3,
        form_away: match.team_b_form || 3
      };

      await processAndStorePrediction(matchId, engineInput);
      processedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      processed: processedCount,
      skipped: skippedCount
    });

  } catch (error) {
    console.error('Cron Ingest Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
