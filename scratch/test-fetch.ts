import 'dotenv/config';
import { apiFootballClient } from '../src/lib/api/apiFootball';
import * as fs from 'fs';
import * as path from 'path';

async function testFetch() {
  console.log('Testing apiFootballClient key:', process.env.API_FOOTBALL_KEY ? 'Present' : 'Missing');
  const cacheDir = path.join(process.cwd(), 'cache', 'api-football');
  
  // Clean up cache to force a fresh fetch
  const file2022 = path.join(cacheDir, 'fixtures_league_39_season_2022.json');
  const file2023 = path.join(cacheDir, 'fixtures_league_39_season_2023.json');
  
  if (fs.existsSync(file2022)) {
    fs.unlinkSync(file2022);
    console.log('Deleted 2022 cache file to force fresh fetch');
  }
  if (fs.existsSync(file2023)) {
    fs.unlinkSync(file2023);
    console.log('Deleted 2023 cache file to force fresh fetch');
  }

  try {
    const fixtures2022 = await apiFootballClient.getFixtures(39, 2022);
    console.log(`Successfully fetched 2022 fixtures. Count: ${fixtures2022.length}`);
    const fixtures2023 = await apiFootballClient.getFixtures(39, 2023);
    console.log(`Successfully fetched 2023 fixtures. Count: ${fixtures2023.length}`);
    
    // Save to cache so we have them locally
    fs.writeFileSync(file2022, JSON.stringify(fixtures2022, null, 2));
    fs.writeFileSync(file2023, JSON.stringify(fixtures2023, null, 2));
    console.log('Saved both files to cache.');
  } catch (err: any) {
    console.error('Fetch failed:', err.message);
  }
}

testFetch();
