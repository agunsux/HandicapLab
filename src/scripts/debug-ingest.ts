import { createClient } from '@supabase/supabase-js';
import { fetchUpcomingFixtures } from '../lib/api/apiFootball';
import { generatePredictions } from '../lib/services/predictionService';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function checkIsNewSchema(): Promise<boolean> {
  try {
    const { error } = await supabase.from('predictions').select('prediction').limit(1);
    return !error || error.code !== '42703';
  } catch {
    return false;
  }
}

async function debugIngest() {
  console.log('Fetching fixtures...');
  const fixtures = await fetchUpcomingFixtures();
  console.log(`Fetched ${fixtures.length} fixtures.`);
  
  console.log('Generating predictions...');
  const predictions = await generatePredictions(fixtures);
  console.log(`Generated ${predictions.length} predictions.`);

  const isNew = await checkIsNewSchema();
  console.log('isNew Schema:', isNew);

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    const prediction = predictions[i];
    
    console.log(`Checking match: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
    const { data: existingMatches, error: selectError } = await supabase
      .from('matches')
      .select('*')
      .eq('home_team', fixture.teams.home.name)
      .eq('away_team', fixture.teams.away.name)
      .eq('kickoff', fixture.fixture.date);

    if (selectError) {
      console.error('Select error:', selectError);
      continue;
    }

    console.log('Existing matches found:', existingMatches?.length || 0);

    let matchData = null;
    let matchError = null;

    if (existingMatches && existingMatches.length > 0) {
      console.log('Updating existing match...');
      const { data: updatedMatch, error: updateError } = await supabase
        .from('matches')
        .update({
          league: fixture.league.name,
          status: 'upcoming'
        })
        .eq('id', existingMatches[0].id)
        .select()
        .single();
      
      matchData = updatedMatch;
      matchError = updateError;
    } else {
      console.log('Inserting new match...');
      const { data: insertedMatch, error: insertError } = await supabase
        .from('matches')
        .insert({
          home_team: fixture.teams.home.name,
          away_team: fixture.teams.away.name,
          league: fixture.league.name,
          kickoff: fixture.fixture.date,
          status: 'upcoming',
        })
        .select()
        .single();

      matchData = insertedMatch;
      matchError = insertError;
    }

    if (matchError) {
      console.error('Match save failed:', matchError);
      continue;
    }

    console.log('Match saved successfully. ID:', matchData?.id);
    
    if (isNew) {
      const records = [
        {
          match_id: String(matchData.id),
          market_type: 'ML',
          home_team: fixture.teams.home.name,
          away_team: fixture.teams.away.name,
          prediction: {
            home_prob: prediction.homeWinProb,
            draw_prob: prediction.drawProb,
            away_prob: prediction.awayWinProb,
            expected_goals: prediction.expectedGoals,
            confidence: prediction.confidenceLevel,
          },
          model_version: prediction.modelVersion,
          feature_version: prediction.featureVersion,
          generated_at: prediction.generatedAt,
          prediction_timestamp: prediction.predictionTimestamp,
          odds_snapshot: prediction.oddsSnapshot,
        }
      ];

      const { error: predictionError } = await supabase
        .from('predictions')
        .insert(records);
      
      if (predictionError) {
        console.error('Prediction save failed:', predictionError);
      } else {
        console.log('Prediction saved successfully.');
      }
    }
  }
}

debugIngest();
