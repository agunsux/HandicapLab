import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { getFootballProvider } from '@/lib/api/providers';
import { runPredictionCron } from '@/lib/crons/prediction';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';

export async function GET(request: Request) {
  // Security check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('ingest');
  
  try {
    console.log('🚀 Starting upcoming match ingestion...');
    
    // Step 1: Fetch upcoming fixtures from selected data provider
    const provider = getFootballProvider();
    console.log(`📡 Using data provider: ${process.env.DATA_PROVIDER || 'api-football'}`);
    console.log('📡 Fetching upcoming fixtures for all registered leagues...');
    
    const { LEAGUE_REGISTRY } = await import('@/lib/crons/leagueRegistry');
    let totalSavedMatches = 0;
    let totalFixturesCount = 0;

    console.log(`[INGEST START]`);
    console.log(`provider selected: ${process.env.DATA_PROVIDER || 'api-football'}`);
    console.log(`competition registry: loaded (${LEAGUE_REGISTRY.length} competitions)`);
    
    const activeLeagues = LEAGUE_REGISTRY.filter(l => l.enabled && (l.status === 'ACTIVE' || l.status === 'BETA'));
    console.log(`leagues requested: ${activeLeagues.map(l => l.name).join(', ')}`);

    for (const leagueConfig of activeLeagues) {
      console.log(`\n[INGEST]`);
      console.log(`provider: ${process.env.DATA_PROVIDER || 'api-football'}`);
      console.log(`competition: ${leagueConfig.name}`);
      console.log(`fixtures requested: true`);

      try {
        const fixtures = await provider.getFixtures(leagueConfig, 2026);
        console.log(`fixtures received: ${fixtures.length}`);
        
        totalFixturesCount += fixtures.length;

        if (fixtures.length === 0) {
          console.log(`[INGEST] reason for 0 fixtures: no fixtures returned by provider for season 2026`);
          continue;
        }

        let leagueInserts = 0;

        // Step 2: Save matches to database
        for (const fixture of fixtures) {
          // Check if match already exists
          const { data: existingMatches, error: selectError } = await supabase
            .from('matches')
            .select('*')
            .eq('home_team', fixture.homeTeam)
            .eq('away_team', fixture.awayTeam)
            .eq('kickoff', fixture.matchDate);

          let matchError = null;
          const isIntMatch = leagueConfig.cohort === 'WORLD_CUP';

          if (selectError) {
            matchError = selectError;
          } else if (existingMatches && existingMatches.length > 0) {
            // Update existing match
            const { error: updateError } = await supabase
              .from('matches')
              .update({
                league: fixture.competitionName,
                status: fixture.status,
                competition_type: isIntMatch ? 'international' : 'club',
                tournament_stage: fixture.tournamentStage || null
              })
              .eq('id', existingMatches[0].id);
            
            matchError = updateError;
          } else {
            // Insert new match
            const { error: insertError } = await supabase
              .from('matches')
              .insert({
                home_team: fixture.homeTeam,
                away_team: fixture.awayTeam,
                league: fixture.competitionName,
                kickoff: fixture.matchDate,
                status: fixture.status,
                competition_type: isIntMatch ? 'international' : 'club',
                tournament_stage: fixture.tournamentStage || null
              });

            matchError = insertError;
          }

          if (matchError) {
            console.error('Error saving match:', matchError, 'for', fixture.homeTeam, 'vs', fixture.awayTeam);
            continue;
          }
          
          leagueInserts++;
          totalSavedMatches++;
        }

        console.log(`database inserts: ${leagueInserts}`);

      } catch (providerError: any) {
        console.error(`❌ Provider error fetching fixtures for ${leagueConfig.name}:`, providerError.message);
        const statusMatch = providerError.message?.match(/Status:\s*(\d+)/i);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : (providerError.status || 500);
        
        await CronLogger.end(logId, totalSavedMatches, providerError);
        try {
          await runHealthCheck();
        } catch (hcErr) {
          console.error('[Ingest Cron] Health check audit failed:', hcErr);
        }

        return NextResponse.json({
          error: 'Provider error',
          provider: process.env.DATA_PROVIDER || 'api-football',
          endpoint: 'getFixtures',
          statusCode: statusCode,
          message: providerError.message
        }, { status: statusCode });
      }
    }
    
    console.log(`\n✅ Successfully saved/updated ${totalSavedMatches} matches in database`);

    // Step 3: Trigger the unified quant prediction pipeline on all upcoming matches
    console.log('🤖 Running ensembled prediction pipeline on upcoming matches...');
    const predResult = await runPredictionCron();
    console.log('🎉 Prediction pipeline execution complete:', predResult);
    
    await CronLogger.end(logId, totalSavedMatches, null);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[Ingest Cron] Health check audit failed:', hcErr);
    }

    return NextResponse.json({
      success: true,
      fixturesCount: totalFixturesCount,
      matchesIngested: totalSavedMatches,
      predictionsResult: predResult
    });

  } catch (error: any) {
    console.error('❌ Ingest error:', error);
    await CronLogger.end(logId, 0, error);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[Ingest Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json(
      { error: 'Ingest failed', details: error.message },
      { status: 500 }
    );
  }
}
