import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePredictions } from '@/lib/services/predictionService';
import { fetchUpcomingFixtures } from '@/lib/api/apiFootball';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: Request) {
  // Security check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    
    // Step 3: Save to database
    let savedCount = 0;
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const prediction = predictions[i];
      
      // Insert or update match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .upsert({
          home_team: fixture.teams.home.name,
          away_team: fixture.teams.away.name,
          league: fixture.league.name,
          kickoff: fixture.fixture.date,
          status: 'upcoming',
        }, {
          onConflict: 'home_team,away_team,kickoff',
        })
        .select()
        .single();
      
      if (matchError) {
        console.error('Error saving match:', matchError, 'for', fixture.teams.home.name, 'vs', fixture.teams.away.name);
        continue;
      }
      
      // Insert prediction
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
        console.error('Error saving prediction:', predictionError);
        continue;
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
