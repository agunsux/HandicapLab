import { fetchUpcomingFixtures } from '../lib/api/apiFootball';

async function main() {
  console.log('Testing api-football fixtures retrieval for World Cup 2026...');
  try {
    const fixtures = await fetchUpcomingFixtures(1, 2026);
    console.log(`Fetched ${fixtures.length} fixtures.`);
    if (fixtures.length > 0) {
      console.log('Sample fixture:');
      console.log(JSON.stringify(fixtures[0], null, 2));
    }
  } catch (err: any) {
    console.error('Error fetching fixtures:', err.message);
  }
}

main();
