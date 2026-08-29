import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

async function testApiFootball() {
  const key = process.env.APIFOOTBALL_KEY;
  const today = new Date().toISOString().slice(0, 10);
  
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?date=${today}`,
    { headers: { 'x-apisports-key': key || '' } }
  );
  const data = await res.json();
  
  console.log(`API-Football status: ${data.results} fixtures today`);
  let sample = data.response?.[0];
  if (data.results === 0) {
    console.warn('WARNING: 0 fixtures today (possible off-day)');
    // Try tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res2 = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${tomorrow}`,
      { headers: { 'x-apisports-key': key || '' } }
    );
    const data2 = await res2.json();
    console.log(`API-Football tomorrow: ${data2.results} fixtures`);
    if (data2.results === 0) {
      console.error('BLOCKED: No fixtures found for today or tomorrow');
      process.exit(1);
    }
    sample = data2.response?.[0];
  }
  
  // Show sample fixture to prove it's real
  if (sample) {
    console.log(`Sample: ${sample.teams.home.name} vs ${sample.teams.away.name} (${sample.league.name})`);
  }
}

async function testOddsPapi() {
  const key = process.env.ODDS_PAPI_KEY;
  const endpoints = [
    `https://api.oddspapi.io/v1/sports/soccer_epl/odds?apiKey=${key}&regions=eu,uk&markets=spreads&oddsFormat=decimal`,
    `https://api.oddspapi.com/v1/sports/soccer_epl/odds?apiKey=${key}&regions=eu,uk&markets=spreads&oddsFormat=decimal`,
    `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${key}&regions=eu,uk&markets=spreads&oddsFormat=decimal`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log(`OddsPapi (${new URL(url).hostname}): ${Array.isArray(data) ? data.length : 0} matches with AH odds`);
        return;
      } else {
        console.warn(`Odds endpoint ${new URL(url).hostname} returned status: ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`Odds endpoint ${new URL(url).hostname} connection error: ${err.message}`);
    }
  }

  console.warn('Proceeding WITHOUT odds (predictions will skip fixtures with no odds / mark AWAITING_ODDS)');
}

async function main() {
  console.log('=== API CONNECTIVITY TEST ===');
  await testApiFootball();
  await testOddsPapi();
  console.log('=== CONNECTIVITY TEST COMPLETE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
