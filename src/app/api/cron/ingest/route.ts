import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePredictions } from '@/lib/services/predictionService';
import { fetchUpcomingFixtures } from '@/lib/api/apiFootball';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// TODO: Sprint 6 Refactor - Ingestion layer should fully target structured FeatureEngine and ProbabilityEngine pipelines and store market-specific predictions

let cachedIsNewSchema: boolean | null = null;

async function checkIsNewSchema(): Promise<boolean> {
  if (cachedIsNewSchema !== null) return cachedIsNewSchema;
  try {
    const { error } = await supabase.from('predictions').select('prediction').limit(1);
    cachedIsNewSchema = !error || error.code !== '42703';
  } catch {
    cachedIsNewSchema = false;
  }
  return cachedIsNewSchema;
}

export async function GET(request: Request) {
  // Security check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== 'Bearer YOUR_CRON_SECRET') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🚀 Starting prediction ingest...');
    
    // Step 1: Fetch upcoming fixtures from API-Football
    console.log('📡 Fetching upcoming fixtures...');
    const fixtures = await fetchUpcomingFixtures();
    console.log(`✅ Fetched ${fixtures.length} fixtures`);
    
    // Step 2: Generate predictions
    console.log('🤖 Generating predictions...');
    const predictions = await generatePredictions(fixtures);
    console.log(`✅ Generated ${predictions.length} predictions`);
    
    const isNew = await checkIsNewSchema();
    
    // Step 3: Save to database
    let savedCount = 0;
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const prediction = predictions[i];
      
      // Check if match already exists
      const { data: existingMatches, error: selectError } = await supabase
        .from('matches')
        .select('*')
        .eq('home_team', fixture.teams.home.name)
        .eq('away_team', fixture.teams.away.name)
        .eq('kickoff', fixture.fixture.date);

      let matchData = null;
      let matchError = null;

      if (selectError) {
        matchError = selectError;
      } else if (existingMatches && existingMatches.length > 0) {
        // Update existing match
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
        // Insert new match
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
        console.error('Error saving match:', matchError, 'for', fixture.teams.home.name, 'vs', fixture.teams.away.name);
        continue;
      }
      
      // Insert prediction(s) based on schema version
      if (isNew) {
        // Insert ML, AH, and OU as separate rows
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
          },
          {
            match_id: String(matchData.id),
            market_type: 'AH',
            home_team: fixture.teams.home.name,
            away_team: fixture.teams.away.name,
            prediction: {
              ah_line: prediction.ahLine,
              ah_prob: prediction.ahHomeProb,
              ah_confidence: prediction.confidenceLevel,
              expected_goals: prediction.expectedGoals,
              confidence: prediction.confidenceLevel,
            },
            model_version: prediction.modelVersion,
            feature_version: prediction.featureVersion,
            generated_at: prediction.generatedAt,
            prediction_timestamp: prediction.predictionTimestamp,
            odds_snapshot: prediction.oddsSnapshot,
          },
          {
            match_id: String(matchData.id),
            market_type: 'OU',
            home_team: fixture.teams.home.name,
            away_team: fixture.teams.away.name,
            prediction: {
              ou_line: prediction.ouLine,
              over_prob: prediction.overProb,
              ou_confidence: prediction.confidenceLevel,
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
          console.error('Error saving market predictions:', predictionError);
          continue;
        }
      } else {
        // Insert single row the old way
        const { error: predictionError } = await supabase
          .from('predictions')
          .insert({
            match_id: matchData.id,
            home_prob: prediction.homeWinProb,
            draw_prob: prediction.drawProb,
            away_prob: prediction.awayWinProb,
            ah_line: prediction.ahLine,
            ah_prob: prediction.ahHomeProb,
            ah_confidence: prediction.confidenceLevel,
            ou_line: prediction.ouLine,
            over_prob: prediction.overProb,
            ou_confidence: prediction.confidenceLevel,
            expected_goals: prediction.expectedGoals,
            confidence: prediction.confidenceLevel,
            model_version: prediction.modelVersion,
            feature_version: prediction.featureVersion,
            generated_at: prediction.generatedAt,
            prediction_timestamp: prediction.predictionTimestamp,
            odds_snapshot: prediction.oddsSnapshot,
          });
        
        if (predictionError) {
          console.error('Error saving legacy prediction:', predictionError);
          continue;
        }
      }
      
      savedCount++;
    }
    
    console.log(`✅ Successfully saved ${savedCount} predictions to database`);
    
    return NextResponse.json({
      success: true,
      fixturesCount: fixtures.length,
      predictionsCount: savedCount,
    });
  } catch (error: any) {
    console.error('❌ Ingest error:', error);
    return NextResponse.json(
      { error: 'Ingest failed', details: error.message },
      { status: 500 }
    );
  }
}
