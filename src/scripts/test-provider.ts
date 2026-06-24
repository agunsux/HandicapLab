import { getFootballProvider } from '../lib/api/providers';
import { LEAGUE_REGISTRY } from '../lib/crons/leagueRegistry';

async function testProvider() {
  console.log('====================================');
  console.log('TEST PROVIDER DIRECTLY');
  console.log('====================================');

  const providerName = process.env.DATA_PROVIDER || 'api-football';
  const provider = getFootballProvider();
  console.log(`provider: ${providerName}`);

  const activeLeagues = LEAGUE_REGISTRY.filter(l => l.enabled && (l.status === 'ACTIVE' || l.status === 'BETA'));
  console.log(`competitions checked: ${activeLeagues.map(l => l.name).join(', ')}`);

  let totalFixtures = 0;
  let sampleFixtureJson = 'None';

  for (const league of activeLeagues) {
    try {
      const fixtures = await provider.getFixtures(league, 2026);
      totalFixtures += fixtures.length;
      if (fixtures.length > 0 && sampleFixtureJson === 'None') {
        sampleFixtureJson = JSON.stringify(fixtures[0], null, 2);
      }
    } catch (e: any) {
      console.log(`Error fetching ${league.name}: ${e.message}`);
    }
  }

  console.log(`fixtures received: ${totalFixtures}`);
  console.log(`sample fixture:\n${sampleFixtureJson}`);
  console.log('====================================');
}

testProvider().catch(console.error);
