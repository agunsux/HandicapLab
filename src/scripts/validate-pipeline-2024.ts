import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { getFootballProvider } from '../lib/api/providers';
import { runPredictionCron } from '../lib/crons/prediction';
import { LEAGUE_REGISTRY } from '../lib/crons/leagueRegistry';
import { createClient } from '@supabase/supabase-js';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runValidation() {
  console.log('🚀 Starting 2024 Validation Pipeline...');
  
  const provider = getFootballProvider();
  
  // Only test with one major league to save API calls and run fast
  const activeLeagues = LEAGUE_REGISTRY.filter(l => l.name === 'Premier League' || l.name === 'Ligue 1');
  
  let totalSavedMatches = 0;

  for (const leagueConfig of activeLeagues) {
    console.log(`\n[VALIDATE] Fetching ${leagueConfig.name} for season 2024...`);
    
    // Lookup competition UUID
    const { data: compData } = await supabase
      .from('competitions')
      .select('id')
      .eq('name', leagueConfig.name)
      .limit(1);
    
    const compRefId = compData && compData.length > 0 ? compData[0].id : null;
    
    try {
      console.log(`\n[VALIDATE] Fetching ${leagueConfig.name} for season 2024...`);
      
      // Archive old upcoming matches
      await supabase.from('matches').update({ status: 'archived' }).eq('status', 'upcoming');

      const fixtures = await provider.getFixtures(leagueConfig, 2024);
      console.log(`fixtures received: ${fixtures.length}`);
      
      if (fixtures.length === 0) continue;

      let leagueInserts = 0;
      
      // Let's just take the first 10 matches so we don't flood the DB or predictions
      const sampleFixtures = fixtures.slice(0, 10);
      
      for (const fixture of sampleFixtures) {
        // Insert new match
        let matchId: string | null = null;
        const { data: matchData, error: insertError } = await supabase
          .from('matches')
          .insert({
            home_team: fixture.homeTeam,
            away_team: fixture.awayTeam,
            league: fixture.competitionName,
            kickoff: fixture.matchDate,
            status: 'upcoming',
            competition_type: 'club',
            tournament_stage: fixture.tournamentStage || null,
            competition_ref_id: compRefId, 
          })
          .select('id')
          .single();

        if (insertError) {
          if (insertError.code === '23505') { // unique violation
            const { data: existing } = await supabase
              .from('matches')
              .select('id')
              .eq('home_team', fixture.homeTeam)
              .eq('away_team', fixture.awayTeam)
              .eq('kickoff', fixture.matchDate)
              .single();
            if (existing) matchId = existing.id;
          } else {
            console.error('Error saving match:', insertError.message);
          }
        } else if (matchData) {
          matchId = matchData.id;
        }
        
        if (matchId) {
          // Insert odds so we can test the EV pipeline!
          const { error: oddsErr } = await supabase.from('odds_snapshots').insert([
            { match_id: matchId, market: 'ML', home_odds: 2.1, draw_odds: 3.4, away_odds: 3.5, bookmaker: 'pinnacle', timestamp: new Date().toISOString() },
            { match_id: matchId, market: 'AH', line: -0.5, home_odds: 2.1, away_odds: 1.8, bookmaker: 'pinnacle', timestamp: new Date().toISOString() },
            { match_id: matchId, market: 'OU', line: 2.5, home_odds: 1.9, away_odds: 1.9, bookmaker: 'pinnacle', timestamp: new Date().toISOString() },
            { match_id: matchId, market: 'BTTS', home_odds: 1.7, away_odds: 2.1, bookmaker: 'pinnacle', timestamp: new Date().toISOString() }
          ]);
          
          if (oddsErr) {
            console.error('Error inserting odds:', oddsErr.message);
          }
          
          leagueInserts++;
        }
        totalSavedMatches++;
      }
      
      console.log(`- inserted match count: ${leagueInserts}`);
    } catch (err: any) {
      console.error(`❌ Provider error for ${leagueConfig.name}:`, err.message);
    }
  }

  console.log(`\n✅ Successfully saved/updated ${totalSavedMatches} matches in database`);

  if (totalSavedMatches > 0) {
    console.log('🤖 Running prediction pipeline on matches...');
    try {
      const predResult = await runPredictionCron();
      console.log('🎉 Prediction pipeline complete:', predResult);
    } catch (e: any) {
      console.error('❌ Prediction pipeline error:', e.message);
    }
  }
}

runValidation().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
