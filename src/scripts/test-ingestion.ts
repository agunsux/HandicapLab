import { getFootballProvider } from '../lib/api/providers';
import { LEAGUE_REGISTRY } from '../lib/crons/leagueRegistry';
import { supabase } from '../lib/supabase.server';

async function testIngestion() {
  console.log('====================================');
  console.log('TEST INGESTION PIPELINE');
  console.log('====================================');

  const providerName = process.env.DATA_PROVIDER || 'api-football';
  const provider = getFootballProvider();
  console.log(`Provider: ${providerName}\n`);

  // We will test with a couple of active competitions first to avoid high API usage
  const testLeagues = LEAGUE_REGISTRY.filter(l => l.enabled && (l.status === 'ACTIVE' || l.status === 'BETA')).slice(0, 3);
  
  let totalFetched = 0;
  let inserted = 0;
  let skipped = 0;

  for (const league of testLeagues) {
    console.log(`Fetching fixtures for ${league.name}...`);
    try {
      const fixtures = await provider.getFixtures(league, 2026);
      console.log(`Fetched ${fixtures.length} fixtures`);
      totalFetched += fixtures.length;

      for (const f of fixtures) {
        // Check if exists
        const { data: existing, error: selectErr } = await supabase
          .from('matches')
          .select('id')
          .eq('home_team', f.homeTeam)
          .eq('away_team', f.awayTeam)
          .eq('kickoff', f.matchDate);

        if (selectErr) {
          console.error(`Select error: ${selectErr.message}`);
          skipped++;
          continue;
        }

        const isIntMatch = league.cohort === 'WORLD_CUP';
        const payload = {
          home_team: f.homeTeam,
          away_team: f.awayTeam,
          league: f.competitionName,
          kickoff: f.matchDate,
          status: f.status,
          competition_type: isIntMatch ? 'international' : 'club',
          tournament_stage: f.tournamentStage || null
        };

        let dbErr = null;
        if (existing && existing.length > 0) {
          const { error: updateErr } = await supabase
            .from('matches')
            .update(payload)
            .eq('id', existing[0].id);
          dbErr = updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from('matches')
            .insert(payload);
          dbErr = insertErr;
        }

        if (dbErr) {
          console.error(`❌ DB Error for ${f.homeTeam} vs ${f.awayTeam}:`, dbErr.message);
          if (dbErr.message.includes('check constraint')) {
            console.error('👉 NOTE: This check constraint violation requires running the SQL fix in supabase/migration_fix.sql');
          }
          skipped++;
        } else {
          inserted++;
        }
      }
    } catch (e: any) {
      console.error(`Error processing ${league.name}:`, e.message);
    }
  }

  console.log('\nResults:');
  console.log(`Fixtures fetched: ${totalFetched}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log('====================================');
}

testIngestion().catch(console.error);
