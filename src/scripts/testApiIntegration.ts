import { apiFootballClient } from '../lib/api/apiFootball';
import { transformFixtureData } from '../lib/data/dataTransformer';
import { rateLimiter } from '../lib/api/rateLimiter';
import { apiCache } from '../lib/api/cache';

async function main() {
  console.log('=========================================');
  console.log('   Testing API-Football Integration      ');
  console.log('=========================================\n');

  const leagueId = 39; // Premier League
  const season = 2024;

  console.log(`1. Fetching fixtures list for League ${leagueId}, Season ${season}...`);
  const fixtures = await apiFootballClient.getFixtures(leagueId, season);
  console.log(`Successfully fetched ${fixtures.length} fixtures.`);

  // Filter completed matches
  const completed = fixtures.filter(f => f.fixture.status.short === 'FT');
  console.log(`Found ${completed.length} completed matches.`);

  if (completed.length === 0) {
    console.error('No completed matches found to test statistics mapping!');
    return;
  }

  // Select 5 matches for testing
  const testMatches = completed.slice(0, 5);
  console.log(`\n2. Testing statistics mapping for 5 fixtures:`);

  for (let i = 0; i < testMatches.length; i++) {
    const f = testMatches[i];
    const fid = f.fixture.id;
    console.log(`\n-----------------------------------------`);
    console.log(`Match #${i + 1}: ${f.teams.home.name} vs ${f.teams.away.name} (Fixture ID: ${fid})`);
    
    // Verify HT score exists
    const htHome = f.score.halftime.home;
    const htAway = f.score.halftime.away;
    console.log(`Halftime score check: Home=${htHome}, Away=${htAway}`);
    
    if (htHome === null || htAway === null) {
      console.warn('WARNING: Halftime score is missing/null in fixture payload!');
    }

    // Verify FT score exists and SH goals are calculable
    const ftHome = f.goals.home;
    const ftAway = f.goals.away;
    console.log(`Fulltime score check: Home=${ftHome}, Away=${ftAway}`);

    if (ftHome !== null && ftAway !== null && htHome !== null && htAway !== null) {
      const shHome = ftHome - htHome;
      const shAway = ftAway - htAway;
      console.log(`Second Half goals calculated: Home=${shHome}, Away=${shAway} (Total: ${shHome + shAway})`);
    } else {
      console.warn('WARNING: Cannot calculate second half goals due to missing score components.');
    }

    // Fetch statistics
    console.log(`Fetching stats for Fixture ID ${fid}...`);
    const stats = await apiFootballClient.getFixtureStatistics(fid);
    
    const homeTeamStats = stats.find(s => s.team.id === f.teams.home.id)?.statistics;
    const awayTeamStats = stats.find(s => s.team.id === f.teams.away.id)?.statistics;

    // Verify we can map stats
    console.log('Mapping statistics to features...');
    const transformed = transformFixtureData(f, homeTeamStats, awayTeamStats);
    
    console.log('Transformed Match Structure:');
    console.log(JSON.stringify({
      matchId: transformed.matchId,
      homeTeam: transformed.homeTeam,
      awayTeam: transformed.awayTeam,
      date: transformed.date,
      input: {
        tempo: transformed.input.domain_tempo,
        pressure: transformed.input.domain_pressure,
        pressure_intensity: (transformed.input as any).pressure_intensity,
        defShapeHome: transformed.input.domain_defensiveShapeHome,
        defShapeAway: transformed.input.domain_defensiveShapeAway,
        htScore: (transformed.input as any).htScore
      },
      outcome: transformed.outcome
    }, null, 2));
  }

  console.log('\n=========================================');
  console.log('3. Verifying Caching & Rate Limiting...');
  console.log('=========================================\n');

  const testFid = testMatches[0].fixture.id;
  console.log(`Fetching statistics for Fixture ID ${testFid} again to verify cache hit...`);
  
  // This second call should be a cache hit (which logs [ApiCache] Cache hit...)
  const statsAgain = await apiFootballClient.getFixtureStatistics(testFid);
  
  console.log('\nChecking today\'s request count via RateLimiter...');
  const count = rateLimiter.getTodayRequestCount();
  console.log(`Current requests made today: ${count}`);

  console.log('\nAll tests completed successfully!');
}

main().catch(console.error);
