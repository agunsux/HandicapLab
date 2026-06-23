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
      const kickoff = new Date(match.date_unix * 1000).toISOString();
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('home_team', match.home_name)
        .eq('away_team', match.away_name)
        .eq('kickoff', kickoff)
        .maybeSingle();

      if (existingMatch) {
        skippedCount++;
        continue;
      }

      // 2. Insert Match directly
      const { data: newMatch, error: matchErr } = await supabase
        .from('matches')
        .insert({
          home_team: match.home_name,
          away_team: match.away_name,
          league: match.competition_name,
          kickoff,
          status: 'upcoming'
        })
        .select('id')
        .single();

      if (matchErr || !newMatch) {
        console.error('Error inserting match:', match.home_name, 'vs', match.away_name, matchErr);
        continue;
      }

      const matchId = newMatch.id;

      // 3. Generate and Store Prediction
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
