import { apiFootballClient } from '../src/lib/api/apiFootball';
import 'dotenv/config';

async function main() {
  console.log('Fetching fixtures from API-Football for league 1, season 2026...');
  try {
    const fixtures = await apiFootballClient.getFixtures(1, 2026);
    console.log(`Fetched ${fixtures.length} fixtures.`);
    
    // Group fixtures by round/stage
    const rounds: Record<string, number> = {};
    const sampleFixtures: any[] = [];
    
    fixtures.forEach(f => {
      const round = f.league.round;
      rounds[round] = (rounds[round] || 0) + 1;
      
      // Let's grab a few samples of knockout rounds or just general rounds
      if (sampleFixtures.length < 30) {
        sampleFixtures.push({
          id: f.fixture.id,
          date: f.fixture.date,
          round: f.league.round,
          home: f.teams.home.name,
          away: f.teams.away.name,
          status: f.fixture.status.short
        });
      }
    });

    console.log('Rounds found in API response:', rounds);
    console.log('\nSample fixtures:');
    console.log(sampleFixtures.slice(0, 15));
    
    // Check if there are any matches like Japan vs Brazil or Germany vs Paraguay
    const specificMatches = fixtures.filter(f => 
      (f.teams.home.name.includes('Japan') && f.teams.away.name.includes('Brazil')) ||
      (f.teams.home.name.includes('Brazil') && f.teams.away.name.includes('Japan')) ||
      (f.teams.home.name.includes('Germany') && f.teams.away.name.includes('Paraguay')) ||
      (f.teams.home.name.includes('Paraguay') && f.teams.away.name.includes('Germany'))
    );
    
    console.log('\nSpecific matches found:', specificMatches.map(f => ({
      round: f.league.round,
      home: f.teams.home.name,
      away: f.teams.away.name
    })));
  } catch (e) {
    console.error('Error fetching:', e);
  }
}

main();
