import { createClient } from '@supabase/supabase-js';
import { fetchUpcomingFixtures } from '../lib/api/apiFootball';
import { runPredictionCron } from '../lib/crons/prediction';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function runPipeline() {
  console.log('🚀 Running World Cup 2026 End-to-End Ingestion & Prediction Pipeline...');

  // 1. Fetch upcoming World Cup fixtures from mock/live API Football client
  console.log('📡 Fetching upcoming World Cup fixtures (apiFootballId: 1)...');
  const fixtures = await fetchUpcomingFixtures(1, 2026);
  console.log(`✅ Fetched ${fixtures.length} fixtures.`);

  // 2. Save matches to Supabase
  let savedCount = 0;
  for (const fixture of fixtures) {
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('*')
      .eq('home_team', fixture.teams.home.name)
      .eq('away_team', fixture.teams.away.name)
      .eq('kickoff', fixture.fixture.date);

    let matchId = null;
    if (existingMatches && existingMatches.length > 0) {
      const { data, error } = await supabase
        .from('matches')
        .update({
          league: 'FIFA World Cup',
          league_id: 1,
          status: 'upcoming',
          competition_type: 'international',
          tournament_stage: fixture.league.round || 'Group Stage'
        })
        .eq('id', existingMatches[0].id)
        .select()
        .single();
      if (error) console.error('Error updating match:', error);
      else matchId = data.id;
    } else {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          home_team: fixture.teams.home.name,
          away_team: fixture.teams.away.name,
          league: 'FIFA World Cup',
          league_id: 1,
          kickoff: fixture.fixture.date,
          status: 'upcoming',
          competition_type: 'international',
          tournament_stage: fixture.league.round || 'Group Stage'
        })
        .select()
        .single();
      if (error) console.error('Error inserting match:', error);
      else matchId = data.id;
    }
    if (matchId) savedCount++;
  }
  console.log(`✅ Successfully saved/updated ${savedCount} matches in database.`);

  // 3. Trigger ensembled prediction pipeline
  console.log('🤖 Running prediction pipeline...');
  const result = await runPredictionCron();
  console.log('🎉 Pipeline completed successfully!');
  process.exit(0);
}

runPipeline().catch(err => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
