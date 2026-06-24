import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { fetchUpcomingFixtures } from '@/lib/api/apiFootball';
import { runPredictionCron } from '@/lib/crons/prediction';

export async function GET(request: Request) {
  // Security check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🚀 Starting upcoming match ingestion...');
    
    // Step 1: Fetch upcoming fixtures from API-Football
    console.log('📡 Fetching upcoming fixtures for all registered leagues...');
    
    const { LEAGUE_REGISTRY } = await import('@/lib/crons/leagueRegistry');
    let totalSavedMatches = 0;
    let totalFixturesCount = 0;

    for (const leagueConfig of LEAGUE_REGISTRY) {
      // Only process enabled leagues with ACTIVE or BETA status (Requirement 4)
      if (!leagueConfig.enabled || (leagueConfig.status !== 'ACTIVE' && leagueConfig.status !== 'BETA')) {
        console.log(`ℹ️ Skipping disabled/inactive league: ${leagueConfig.name}`);
        continue;
      }

      console.log(`📡 Fetching upcoming fixtures for ${leagueConfig.name} (apiFootballId: ${leagueConfig.apiFootballId})...`);
      // We use 2026 as the active season since current local time is 2026-06-24
      const fixtures = await fetchUpcomingFixtures(leagueConfig.apiFootballId, 2026);
      console.log(`✅ Fetched ${fixtures.length} fixtures for ${leagueConfig.name}`);
      totalFixturesCount += fixtures.length;

      if (fixtures.length === 0) continue;

      // Step 2: Save matches to database
      for (const fixture of fixtures) {
        // Check if match already exists
        const { data: existingMatches, error: selectError } = await supabase
          .from('matches')
          .select('*')
          .eq('home_team', fixture.teams.home.name)
          .eq('away_team', fixture.teams.away.name)
          .eq('kickoff', fixture.fixture.date);

        let matchError = null;
        const isIntMatch = leagueConfig.cohort === 'WORLD_CUP';

        if (selectError) {
          matchError = selectError;
        } else if (existingMatches && existingMatches.length > 0) {
          // Update existing match
          const { error: updateError } = await supabase
            .from('matches')
            .update({
              league: fixture.league.name,
              status: 'upcoming',
              competition_type: isIntMatch ? 'international' : 'club',
              tournament_stage: fixture.league.round || null
            })
            .eq('id', existingMatches[0].id);
          
          matchError = updateError;
        } else {
          // Insert new match
          const { error: insertError } = await supabase
            .from('matches')
            .insert({
              home_team: fixture.teams.home.name,
              away_team: fixture.teams.away.name,
              league: fixture.league.name,
              kickoff: fixture.fixture.date,
              status: 'upcoming',
              competition_type: isIntMatch ? 'international' : 'club',
              tournament_stage: fixture.league.round || null
            });

          matchError = insertError;
        }

        if (matchError) {
          console.error('Error saving match:', matchError, 'for', fixture.teams.home.name, 'vs', fixture.teams.away.name);
          continue;
        }
        
        totalSavedMatches++;
      }
    }
    
    console.log(`✅ Successfully saved/updated ${totalSavedMatches} matches in database`);

    // Step 3: Trigger the unified quant prediction pipeline on all upcoming matches
    console.log('🤖 Running ensembled prediction pipeline on upcoming matches...');
    const predResult = await runPredictionCron();
    console.log('🎉 Prediction pipeline execution complete:', predResult);
    
    return NextResponse.json({
      success: true,
      fixturesCount: totalFixturesCount,
      matchesIngested: totalSavedMatches,
      predictionsResult: predResult
    });

  } catch (error: any) {
    console.error('❌ Ingest error:', error);
    return NextResponse.json(
      { error: 'Ingest failed', details: error.message },
      { status: 500 }
    );
  }
}
