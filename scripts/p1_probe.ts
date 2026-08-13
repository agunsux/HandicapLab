import axios from 'axios';

// Credentials are read from the environment only — never hardcode API keys in source.
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY || '';
const ODDS_PAPI_KEY = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '';

async function runProbe() {
  console.log('==================================================');
  console.log('HANDICAP_LAB — P1 READ-ONLY PROVIDER PROBE (v2)');
  console.log('==================================================\n');

  // 1. API-Football Probe
  console.log('--- API-Football ---');
  try {
    if (!API_FOOTBALL_KEY) {
      console.log('API_FOOTBALL_KEY not configured; skipping probe.');
    } else {
      const statusRes = await axios.get('https://v3.football.api-sports.io/status', {
        headers: { 'x-apisports-key': API_FOOTBALL_KEY }
      });
      console.log('Status HTTP:', statusRes.status);
      console.log('Account Status:', statusRes.data.response?.account || statusRes.data.errors);
      console.log('Requests today:', statusRes.data.response?.requests);

      const today = new Date().toISOString().split('T')[0];
      const fixRes = await axios.get(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
        headers: { 'x-apisports-key': API_FOOTBALL_KEY }
      });
      console.log(`Fixtures today (${today}):`, fixRes.data.results);
    }
  } catch (err: any) {
    console.error('API-Football Error:', err.response?.data || err.message);
  }

  console.log('\n--- OddsPAPI ---');
  try {
    if (!ODDS_PAPI_KEY) {
      console.log('ODDS_PAPI_KEY not configured; skipping probe.');
    } else {
      // According to config.ts, baseUrl is 'https://api.oddspapi.io/v4'
      const sportsRes = await axios.get(`https://api.oddspapi.io/v4/sports?apiKey=${ODDS_PAPI_KEY}`);
      console.log('Status HTTP:', sportsRes.status);
      console.log('Sports Data:', Array.isArray(sportsRes.data) ? `Array of ${sportsRes.data.length} sports` : typeof sportsRes.data);
    }
  } catch (err: any) {
    console.error('OddsPAPI Error:', err.response?.data || err.message);
  }
}

runProbe();
