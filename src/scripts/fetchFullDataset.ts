import { historicalDataFetcher } from '../lib/data/historicalDataFetcher';

async function main() {
  console.log('=========================================');
  console.log('     Fetching Full Historical Dataset     ');
  console.log('=========================================\n');

  console.log('Initiating batch historical fetch process...');
  const progress = await historicalDataFetcher.fetchAll(90); // limit to 90 API calls per session
  
  console.log('\n=========================================');
  console.log('          Fetch Process Finished          ');
  console.log('=========================================');
  console.log('Progress Summary:');
  console.log(`- Leagues Processed: ${progress.leaguesProcessed}`);
  console.log(`- Total Fixtures: ${progress.fixturesFetched}`);
  console.log(`- Stats Fetched: ${progress.statsFetched}`);
  console.log(`- Stored Cache Hits: ${progress.cacheHits}`);
  console.log(`- API Calls Made: ${progress.apiRequests}`);
}

main().catch(console.error);
