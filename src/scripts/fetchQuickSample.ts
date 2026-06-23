import { apiFootballClient } from '../lib/api/apiFootball';
import { transformFixtureData, TransformedMatch } from '../lib/data/dataTransformer';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=========================================');
  console.log('       Fetching Quick Sample Data        ');
  console.log('=========================================\n');

  const leagueId = 39; // Premier League
  const season = 2024;
  const sampleSize = 100;
  const outputFile = path.join(process.cwd(), 'cache', 'api-football', 'quick_sample.json');

  console.log(`Fetching fixtures for League ${leagueId}, Season ${season}...`);
  const fixtures = await apiFootballClient.getFixtures(leagueId, season);
  
  // Filter to finished matches
  const completed = fixtures.filter(
    f => f.fixture.status.short === 'FT' && f.score.halftime.home !== null
  );
  
  console.log(`Found ${completed.length} completed fixtures.`);
  const selected = completed.slice(0, Math.min(sampleSize, completed.length));
  console.log(`Selected ${selected.length} fixtures for quick sample.`);

  const transformedMatches: Record<string, TransformedMatch> = {};

  for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    const fid = f.fixture.id;
    console.log(`[${i + 1}/${selected.length}] Fetching statistics for fixture ${fid}...`);

    try {
      const stats = await apiFootballClient.getFixtureStatistics(fid);
      const homeStats = stats.find(s => s.team.id === f.teams.home.id)?.statistics;
      const awayStats = stats.find(s => s.team.id === f.teams.away.id)?.statistics;

      const transformed = transformFixtureData(f, homeStats, awayStats);
      transformedMatches[fid] = transformed;
    } catch (e) {
      console.error(`Failed to fetch stats for fixture ${fid}:`, e);
    }
  }

  // Ensure output directory exists
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(Object.values(transformedMatches), null, 2), 'utf-8');
  console.log(`\nSuccessfully stored ${Object.keys(transformedMatches).length} matches in ${outputFile}`);
}

main().catch(console.error);
